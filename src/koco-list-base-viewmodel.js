// Copyright (c) CBC/Radio-Canada. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

define([
        'knockout',
        'jquery',
        'lodash',
        'object-utilities',
        'string-utilities',
        'mapping-utilities',
        'disposer'
    ],
    function(ko, $, _,
        objectUtilities, stringUtilities, mappingUtilities, Disposer) {
        'use strict';

        //TODO: Utiliser paging-trait !?
        var ContentListBaseViewModel = function(api, apiResourceName, settings) {
            var self = this;

            if (!api) {
                throw new Error('ContentListBaseViewModel - missing api');
            }

            if (!apiResourceName) {
                throw new Error('ContentListBaseViewModel - missing api resource name');
            }

            var defaultSettings = {
                defaultSearchArguments: {},
                pageable: true
            };

            var defaultPagingArguments = {
                orderByDirection: null,
                orderBy: null,
                pageNumber: null,
                pageSize: null
            };

            self.disposer = new Disposer();
            self.apiResourceName = apiResourceName;
            self.api = api;

            self.settings = $.extend({}, defaultSettings, settings);

            self.apiSearchArguments = Object.keys(self.settings.defaultSearchArguments).concat(Object.keys(defaultPagingArguments));
            self.searchArguments = null;
            self.isSearchInProgress = ko.observable(false);
            self.searchArguments = ko.mapping.fromJS(self.settings.defaultSearchArguments);
            self.totalNumberOfItems = ko.observable();
            self.items = ko.observableArray([]);

            self.hasItems = ko.pureComputed(function() {
                return self.items().length > 0;
            });
            self.disposer.add(self.hasItems);

            self.pagingArguments = ko.observable(defaultPagingArguments);

            self.remainingItemsToLoad = ko.observable(false);

            self.isPaging = ko.observable(false);
        };

        ContentListBaseViewModel.prototype.toApiCriteria = function(searchArguments) {
            //This is error prone... this means that you have to pass all possible search fields to the
            //defaultSearchArguments setting in order to be able to use a specific field later (may be acceptable but must be explicit)
            var criteria = _.pick(searchArguments, this.apiSearchArguments);

            return criteria;
        };

        ContentListBaseViewModel.prototype.onSearchFail = function(jqXhr, textStatus, errorThrown) {
            var self = this;

            if (errorThrown !== 'abort') {
                self.handleUnknownError(jqXhr, textStatus, errorThrown);
            }
        };

        ContentListBaseViewModel.prototype.onSearchSuccess = function(searchResult) {
            var self = this;

            if (self.settings.pageable) {
                updatePagingInfo(self, searchResult);
            }

            self.totalNumberOfItems(self.getTotalNumberOfItemsFromSearchResult(searchResult));

            var newItems = self.getItemsFromSearchResult(searchResult);

            self.addPropertiesToItems(newItems);

            if (self.settings.pageable) {
                var allItems = newItems;

                if (self.isPaging()) {
                    allItems = self.items();

                    for (var i = 0; i < newItems.length; i++) {

                        allItems.push(newItems[i]);
                    }
                }

                //Doit être fait avant la ligne suivante
                self.remainingItemsToLoad(allItems.length < searchResult.totalNumberOfItems);
                self.items(allItems);
            } else {
                self.items(newItems);
            }
        };

        ContentListBaseViewModel.prototype.getTotalNumberOfItemsFromSearchResult = function(searchResult) {
            //var self = this;

            return searchResult.totalNumberOfItems;
        };

        ContentListBaseViewModel.prototype.searchWithFilters = function() {
            var self = this;

            if (self.settings.pageable) {
                self.resetPageNumber();
            }

            self.searchArguments = self.getSearchArguments();

            if (self.settings.pageable) {
                self.updateSearchArgumentsWithPagingArguments();
            }

            return self.search();
        };

        ContentListBaseViewModel.prototype.search = function() {
            var self = this;

            self.isSearchInProgress(true);

            var apiCriteria = self.toApiCriteria(self.searchArguments);

            var promise = self.api.getJson(self.apiResourceName, {
                    data: $.param(apiCriteria, true)
                })
                .done(function(searchResult) {
                    self.onSearchSuccess(searchResult);
                })
                .fail(function(jqXhr, textStatus, errorThrown) {
                    self.onSearchFail(jqXhr, textStatus, errorThrown);
                })
                .always(function() {
                    if (self.settings.pageable) {
                        self.isPaging(false);
                    }

                    self.isSearchInProgress(false);
                });

            return promise;
        };

        ContentListBaseViewModel.prototype.resetPageNumber = function() {
            var self = this;

            var pagingArguments = self.pagingArguments();
            pagingArguments.pageNumber = null;

            self.pagingArguments(pagingArguments);
        };

        ContentListBaseViewModel.prototype.updateSearchArgumentsWithPagingArguments = function() {
            var self = this;

            self.searchArguments = $.extend({}, self.searchArguments, objectUtilities.pickNonFalsy(self.pagingArguments()));
        };

        ContentListBaseViewModel.prototype.goToNextPage = function() {
            var self = this;
            self.isPaging(true);

            var pagingArguments = self.pagingArguments();

            //TODO: pageNumber == convention == not good
            pagingArguments.pageNumber = (pagingArguments.pageNumber || 1) + 1;
            self.pagingArguments(pagingArguments);

            self.updateSearchArgumentsWithPagingArguments();

            return self.search();
        };

        ContentListBaseViewModel.prototype.updateOrderBy = function(newOrderBy) {
            var self = this;
            var pagingArguments = self.pagingArguments();

            if (stringUtilities.equalsIgnoreCase(pagingArguments.orderBy, newOrderBy)) {
                if (stringUtilities.equalsIgnoreCase(pagingArguments.orderByDirection, 'ascending')) {
                    pagingArguments.orderByDirection = 'descending';
                } else {
                    pagingArguments.orderByDirection = 'ascending';
                }
            } else {
                pagingArguments.orderByDirection = null;
                pagingArguments.orderBy = newOrderBy;
            }

            self.pagingArguments(pagingArguments);

            self.updateSearchArgumentsWithPagingArguments();

            self.search();
        };

        ContentListBaseViewModel.prototype.addPropertiesToItems = function(items) {
            var self = this;

            for (var i = 0; i < items.length; i++) {
                var item = items[i];

                self.addPropertiesToSearchResultItem(item);
            }
        };

        ContentListBaseViewModel.prototype.addPropertiesToSearchResultItem = function(item) {
            //var self = this;
        };

        ContentListBaseViewModel.prototype.getItemsFromSearchResult = function(searchResult) {
            //var self = this;

            return _.compact(searchResult.items);
        };

        ContentListBaseViewModel.prototype.getSearchArguments = function() {
            var self = this;

            var searchArguments = mappingUtilities.toJS(self.searchArguments);
            searchArguments = objectUtilities.pickNonFalsy(searchArguments);

            return searchArguments;
        };

        ContentListBaseViewModel.prototype.handleUnknownError = function(jqXHR, textStatus, errorThrown) {};

        ContentListBaseViewModel.prototype.dispose = function() {
            this.disposer.dispose();
        };

        ContentListBaseViewModel.prototype.getUpdatedPagingArgumentsFromSearchResult = function(searchResult) {
            //var self = this;

            return {
                pageNumber: searchResult.pageNumber,
                pageSize: searchResult.pageSize,
                orderBy: searchResult.orderBy,
                orderByDirection: searchResult.orderByDirection
            };
        };

        function updatePagingInfo(self, searchResult) {
            var pagingArguments = self.getUpdatedPagingArgumentsFromSearchResult(searchResult);

            self.pagingArguments(pagingArguments);
            self.updateSearchArgumentsWithPagingArguments();
        }

        return ContentListBaseViewModel;
    });
