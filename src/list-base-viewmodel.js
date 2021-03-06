// Copyright (c) CBC/Radio-Canada. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import ko from 'knockout';
import $ from 'jquery';
import _ from 'lodash';
import objectUtilities from 'koco-object-utilities';
import stringUtilities from 'koco-string-utilities';
import urls from 'koco-url-utilities';
import Disposer from 'koco-disposer';


//TODO: Utiliser paging-trait/part !?
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

  self.disposer = new Disposer();
  self.apiResourceName = apiResourceName;
  self.api = api;

  self.settings = $.extend({}, defaultSettings, settings);

  var pagingAttr = {
    pageNumber: 'pageNumber',
    pageSize: 'pageSize',
    orderBy: 'orderBy',
    orderByDirection: 'orderByDirection'
  };

  self.settings.defaultPagingAttr = $.extend({}, pagingAttr, self.settings.defaultPagingAttr);


  var defaultPagingArguments = {};
  _.each(self.settings.defaultPagingAttr, function(attr /*, key*/ ) {
    defaultPagingArguments[attr] = null;
  });

  self.apiSearchArguments = Object.keys(self.settings.defaultSearchArguments).concat(Object.keys(defaultPagingArguments));
  self.searchArguments = null;
  self.isSearchInProgress = ko.observable(false);
  self.searchArguments = self.settings.defaultSearchArguments;
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

//todo: rename async
ContentListBaseViewModel.prototype.onSearchFail = function(ex) {
    return this.handleUnknownError(ex);
};

//todo: rename async
ContentListBaseViewModel.prototype.onSearchSuccess = function(searchResult) {
  var self = this;

  if (self.settings.pageable) {
    self.updatePagingInfo(searchResult);
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

  return Promise.resolve(...arguments);
};

ContentListBaseViewModel.prototype.getTotalNumberOfItemsFromSearchResult = function(searchResult) {
  //var self = this;

  return searchResult.totalNumberOfItems;
};

//todo: rename async
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

//todo: rename async
ContentListBaseViewModel.prototype.search = function() {
  var self = this;

  self.isSearchInProgress(true);

  const apiCriteria = self.toApiCriteria(self.searchArguments);
  const url = urls.appendParams(self.apiResourceName, apiCriteria, true);

  return self.api.fetch(url)
    .then((searchResult) => self.onSearchSuccess(searchResult))
    .catch(ex => self.onSearchFail(ex))
    .then(() => {
      if (self.settings.pageable) {
        self.isPaging(false);
      }

      // todo: hack for problem with triggerWhenScrolledToBottom which fires mutltiple times (find a better solution)
      setTimeout(() => {
        self.isSearchInProgress(false);
      }, 50);
    });
};

ContentListBaseViewModel.prototype.resetPageNumber = function() {
  var self = this;

  var pagingArguments = self.pagingArguments();
  pagingArguments[self.settings.defaultPagingAttr.pageNumber] = null;

  self.pagingArguments(pagingArguments);
};

ContentListBaseViewModel.prototype.updateSearchArgumentsWithPagingArguments = function() {
  var self = this;
  var cleanedPagingArguments = objectUtilities.pickNonFalsy(self.pagingArguments());
  self.searchArguments = $.extend({}, self.searchArguments, cleanedPagingArguments);
};

//todo: rename async
ContentListBaseViewModel.prototype.goToNextPage = function() {
  var self = this;
  self.isPaging(true);

  var pagingArguments = self.pagingArguments();

  pagingArguments[self.settings.defaultPagingAttr.pageNumber] = (pagingArguments[self.settings.defaultPagingAttr.pageNumber] || 1) + 1;
  self.pagingArguments(pagingArguments);

  self.updateSearchArgumentsWithPagingArguments();

  return self.search();
};

//todo: rename async
ContentListBaseViewModel.prototype.updateOrderBy = function(newOrderBy) {
  var self = this;
  var pagingArguments = self.pagingArguments();

  if (stringUtilities.equalsIgnoreCase(pagingArguments[self.settings.defaultPagingAttr.orderBy], newOrderBy)) {
    if (stringUtilities.equalsIgnoreCase(pagingArguments[self.settings.defaultPagingAttr.orderByDirection], 'ascending')) {
      pagingArguments[self.settings.defaultPagingAttr.orderByDirection] = 'descending';
    } else {
      pagingArguments[self.settings.defaultPagingAttr.orderByDirection] = 'ascending';
    }
  } else {
    pagingArguments[self.settings.defaultPagingAttr.orderByDirection] = 'ascending';
    pagingArguments[self.settings.defaultPagingAttr.orderBy] = newOrderBy;
  }

  self.pagingArguments(pagingArguments);

  return self.searchWithFilters();
};

ContentListBaseViewModel.prototype.addPropertiesToItems = function(items) {
  var self = this;

  for (var i = 0; i < items.length; i++) {
    var item = items[i];

    self.addPropertiesToSearchResultItem(item);
  }
};

ContentListBaseViewModel.prototype.addPropertiesToSearchResultItem = function( /*item*/ ) {
  //var self = this;
};

ContentListBaseViewModel.prototype.getItemsFromSearchResult = function(searchResult) {
  //var self = this;

  return _.compact(searchResult.items);
};

ContentListBaseViewModel.prototype.getSearchArguments = function() {
  var self = this;

  return objectUtilities.pickNonFalsy(self.searchArguments);
};

//todo: rename async
ContentListBaseViewModel.prototype.handleUnknownError = function(ex) {
  return Promise.reject(ex);
};

ContentListBaseViewModel.prototype.dispose = function() {
  this.disposer.dispose();
};

ContentListBaseViewModel.prototype.getUpdatedPagingArgumentsFromSearchResult = function( /*searchResult*/ ) {
  var self = this;

  return self.pagingArguments();
};

ContentListBaseViewModel.prototype.updatePagingInfo = function(searchResult) {
  var self = this;
  var pagingArguments = self.getUpdatedPagingArgumentsFromSearchResult(searchResult);

  self.pagingArguments(pagingArguments);
  self.updateSearchArgumentsWithPagingArguments();
};

export default ContentListBaseViewModel;
