'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _knockout = require('knockout');

var _knockout2 = _interopRequireDefault(_knockout);

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _objectUtilities = require('object-utilities');

var _objectUtilities2 = _interopRequireDefault(_objectUtilities);

var _stringUtilities = require('string-utilities');

var _stringUtilities2 = _interopRequireDefault(_stringUtilities);

var _mappingUtilities = require('mapping-utilities');

var _mappingUtilities2 = _interopRequireDefault(_mappingUtilities);

var _disposer = require('disposer');

var _disposer2 = _interopRequireDefault(_disposer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//TODO: Utiliser paging-trait/part !?
var ContentListBaseViewModel = function ContentListBaseViewModel(api, apiResourceName, settings) {
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

    self.disposer = new _disposer2.default();
    self.apiResourceName = apiResourceName;
    self.api = api;

    self.settings = _jquery2.default.extend({}, defaultSettings, settings);

    var pagingAttr = {
        pageNumber: 'pageNumber',
        pageSize: 'pageSize',
        orderBy: 'orderBy',
        orderByDirection: 'orderByDirection'
    };

    self.settings.defaultPagingAttr = _jquery2.default.extend({}, pagingAttr, self.settings.defaultPagingAttr);

    var defaultPagingArguments = {};
    _lodash2.default.each(self.settings.defaultPagingAttr, function (attr /*, key*/) {
        defaultPagingArguments[attr] = null;
    });

    self.apiSearchArguments = Object.keys(self.settings.defaultSearchArguments).concat(Object.keys(defaultPagingArguments));
    self.searchArguments = null;
    self.isSearchInProgress = _knockout2.default.observable(false);
    self.searchArguments = self.settings.defaultSearchArguments;
    self.totalNumberOfItems = _knockout2.default.observable();
    self.items = _knockout2.default.observableArray([]);

    self.hasItems = _knockout2.default.pureComputed(function () {
        return self.items().length > 0;
    });
    self.disposer.add(self.hasItems);

    self.pagingArguments = _knockout2.default.observable(defaultPagingArguments);

    self.remainingItemsToLoad = _knockout2.default.observable(false);

    self.isPaging = _knockout2.default.observable(false);
}; // Copyright (c) CBC/Radio-Canada. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

ContentListBaseViewModel.prototype.toApiCriteria = function (searchArguments) {
    //This is error prone... this means that you have to pass all possible search fields to the
    //defaultSearchArguments setting in order to be able to use a specific field later (may be acceptable but must be explicit)
    var criteria = _lodash2.default.pick(searchArguments, this.apiSearchArguments);

    return criteria;
};

//todo: rename async
ContentListBaseViewModel.prototype.onSearchFail = function (jqXhr, textStatus, errorThrown) {
    var _$$Deferred;

    var self = this;

    if (errorThrown !== 'abort') {
        return self.handleUnknownError.apply(self, arguments);
    }

    return (_$$Deferred = _jquery2.default.Deferred()).reject.apply(_$$Deferred, arguments).promise();
};

//todo: rename async
ContentListBaseViewModel.prototype.onSearchSuccess = function (searchResult) {
    var _$$Deferred2;

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

    return (_$$Deferred2 = _jquery2.default.Deferred()).resolve.apply(_$$Deferred2, arguments).promise();
};

ContentListBaseViewModel.prototype.getTotalNumberOfItemsFromSearchResult = function (searchResult) {
    //var self = this;

    return searchResult.totalNumberOfItems;
};

//todo: rename async
ContentListBaseViewModel.prototype.searchWithFilters = function () {
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
ContentListBaseViewModel.prototype.search = function () {
    var self = this;

    self.isSearchInProgress(true);

    var apiCriteria = self.toApiCriteria(self.searchArguments);

    return self.api.getJson(self.apiResourceName, {
        data: _jquery2.default.param(apiCriteria, true)
    }).then(function (searchResult) {
        return self.onSearchSuccess(searchResult);
    }, function (jqXhr, textStatus, errorThrown) {
        return self.onSearchFail(jqXhr, textStatus, errorThrown);
    }).always(function () {
        if (self.settings.pageable) {
            self.isPaging(false);
        }

        self.isSearchInProgress(false);
    });
};

ContentListBaseViewModel.prototype.resetPageNumber = function () {
    var self = this;

    var pagingArguments = self.pagingArguments();
    pagingArguments[self.settings.defaultPagingAttr.pageNumber] = null;

    self.pagingArguments(pagingArguments);
};

ContentListBaseViewModel.prototype.updateSearchArgumentsWithPagingArguments = function () {
    var self = this;
    var cleanedPagingArguments = _objectUtilities2.default.pickNonFalsy(self.pagingArguments());
    self.searchArguments = _jquery2.default.extend({}, self.searchArguments, cleanedPagingArguments);
};

//todo: rename async
ContentListBaseViewModel.prototype.goToNextPage = function () {
    var self = this;
    self.isPaging(true);

    var pagingArguments = self.pagingArguments();

    pagingArguments[self.settings.defaultPagingAttr.pageNumber] = (pagingArguments[self.settings.defaultPagingAttr.pageNumber] || 1) + 1;
    self.pagingArguments(pagingArguments);

    self.updateSearchArgumentsWithPagingArguments();

    return self.search();
};

//todo: rename async
ContentListBaseViewModel.prototype.updateOrderBy = function (newOrderBy) {
    var self = this;
    var pagingArguments = self.pagingArguments();

    if (_stringUtilities2.default.equalsIgnoreCase(pagingArguments[self.settings.defaultPagingAttr.orderBy], newOrderBy)) {
        if (_stringUtilities2.default.equalsIgnoreCase(pagingArguments[self.settings.defaultPagingAttr.orderByDirection], 'ascending')) {
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

ContentListBaseViewModel.prototype.addPropertiesToItems = function (items) {
    var self = this;

    for (var i = 0; i < items.length; i++) {
        var item = items[i];

        self.addPropertiesToSearchResultItem(item);
    }
};

ContentListBaseViewModel.prototype.addPropertiesToSearchResultItem = function () /*item*/{
    //var self = this;
};

ContentListBaseViewModel.prototype.getItemsFromSearchResult = function (searchResult) {
    //var self = this;

    return _lodash2.default.compact(searchResult.items);
};

ContentListBaseViewModel.prototype.getSearchArguments = function () {
    var self = this;

    return _objectUtilities2.default.pickNonFalsy(self.searchArguments);
};

//todo: rename async
ContentListBaseViewModel.prototype.handleUnknownError = function () /*jqXHR, textStatus, errorThrown*/{
    return _jquery2.default.Deferred().resolve().promise();
};

ContentListBaseViewModel.prototype.dispose = function () {
    this.disposer.dispose();
};

ContentListBaseViewModel.prototype.getUpdatedPagingArgumentsFromSearchResult = function () /*searchResult*/{
    var self = this;

    return self.pagingArguments();
};

ContentListBaseViewModel.prototype.updatePagingInfo = function (searchResult) {
    var self = this;
    var pagingArguments = self.getUpdatedPagingArgumentsFromSearchResult(searchResult);

    self.pagingArguments(pagingArguments);
    self.updateSearchArgumentsWithPagingArguments();
};

exports.default = ContentListBaseViewModel;