 // Shorthand delegations.
 var parse = sce.parseAs,
 getTrusted = sce.getTrusted,
 trustAs = sce.trustAs;

forEach(SCE_CONTEXTS, function(enumValue, name) {
var lName = lowercase(name);
sce[snakeToCamel('parse_as_' + lName)] = function(expr) {
 return parse(enumValue, expr);
};
sce[snakeToCamel('get_trusted_' + lName)] = function(value) {
 return getTrusted(enumValue, value);
};
sce[snakeToCamel('trust_as_' + lName)] = function(value) {
 return trustAs(enumValue, value);
};
});

return sce;
}];
}

/* exported $SnifferProvider */

/**
* !!! This is an undocumented "private" service !!!
*
* @name $sniffer
* @requires $window
* @requires $document
* @this
*
* @property {boolean} history Does the browser support html5 history api ?
* @property {boolean} transitions Does the browser support CSS transition events ?
* @property {boolean} animations Does the browser support CSS animation events ?
*
* @description
* This is very simple implementation of testing browser's features.
*/
function $SnifferProvider() {
this.$get = ['$window', '$document', function($window, $document) {
var eventSupport = {},
 // Chrome Packaged Apps are not allowed to access `history.pushState`.
 // If not sandboxed, they can be detected by the presence of `chrome.app.runtime`
 // (see https://developer.chrome.com/apps/api_index). If sandboxed, they can be detected by
 // the presence of an extension runtime ID and the absence of other Chrome runtime APIs
 // (see https://developer.chrome.com/apps/manifest/sandbox).
 // (NW.js apps have access to Chrome APIs, but do support `history`.)
 isNw = $window.nw && $window.nw.process,
 isChromePackagedApp =
     !isNw &&
     $window.chrome &&
     ($window.chrome.app && $window.chrome.app.runtime ||
         !$window.chrome.app && $window.chrome.runtime && $window.chrome.runtime.id),
 hasHistoryPushState = !isChromePackagedApp && $window.history && $window.history.pushState,
 android =
   toInt((/android (\d+)/.exec(lowercase(($window.navigator || {}).userAgent)) || [])[1]),
 boxee = /Boxee/i.test(($window.navigator || {}).userAgent),
 document = $document[0] || {},
 bodyStyle = document.body && document.body.style,
 transitions = false,
 animations = false;

if (bodyStyle) {
// Support: Android <5, Blackberry Browser 10, default Chrome in Android 4.4.x
// Mentioned browsers need a -webkit- prefix for transitions & animations.
transitions = !!('transition' in bodyStyle || 'webkitTransition' in bodyStyle);
animations = !!('animation' in bodyStyle || 'webkitAnimation' in bodyStyle);
}


return {
// Android has history.pushState, but it does not update location correctly
// so let's not use the history API at all.
// http://code.google.com/p/android/issues/detail?id=17471
// https://github.com/angular/angular.js/issues/904

// older webkit browser (533.9) on Boxee box has exactly the same problem as Android has
// so let's not use the history API also
// We are purposefully using `!(android < 4)` to cover the case when `android` is undefined
history: !!(hasHistoryPushState && !(android < 4) && !boxee),
hasEvent: function(event) {
 // Support: IE 9-11 only
 // IE9 implements 'input' event it's so fubared that we rather pretend that it doesn't have
 // it. In particular the event is not fired when backspace or delete key are pressed or
 // when cut operation is performed.
 // IE10+ implements 'input' event but it erroneously fires under various situations,
 // e.g. when placeholder changes, or a form is focused.
 if (event === 'input' && msie) return false;

 if (isUndefined(eventSupport[event])) {
   var divElm = document.createElement('div');
   eventSupport[event] = 'on' + event in divElm;
 }

 return eventSupport[event];
},
csp: csp(),
transitions: transitions,
animations: animations,
android: android
};
}];
}

var $templateRequestMinErr = minErr('$compile');

/**
* @ngdoc provider
* @name $templateRequestProvider
* @this
*
* @description
* Used to configure the options passed to the {@link $http} service when making a template request.
*
* For example, it can be used for specifying the "Accept" header that is sent to the server, when
* requesting a template.
*/
function $TemplateRequestProvider() {

var httpOptions;

/**
* @ngdoc method
* @name $templateRequestProvider#httpOptions
* @description
* The options to be passed to the {@link $http} service when making the request.
* You can use this to override options such as the "Accept" header for template requests.
*
* The {@link $templateRequest} will set the `cache` and the `transformResponse` properties of the
* options if not overridden here.
*
* @param {string=} value new value for the {@link $http} options.
* @returns {string|self} Returns the {@link $http} options when used as getter and self if used as setter.
*/
this.httpOptions = function(val) {
if (val) {
httpOptions = val;
return this;
}
return httpOptions;
};

/**
* @ngdoc service
* @name $templateRequest
*
* @description
* The `$templateRequest` service runs security checks then downloads the provided template using
* `$http` and, upon success, stores the contents inside of `$templateCache`. If the HTTP request
* fails or the response data of the HTTP request is empty, a `$compile` error will be thrown (the
* exception can be thwarted by setting the 2nd parameter of the function to true). Note that the
* contents of `$templateCache` are trusted, so the call to `$sce.getTrustedUrl(tpl)` is omitted
* when `tpl` is of type string and `$templateCache` has the matching entry.
*
* If you want to pass custom options to the `$http` service, such as setting the Accept header you
* can configure this via {@link $templateRequestProvider#httpOptions}.
*
* `$templateRequest` is used internally by {@link $compile}, {@link ngRoute.$route}, and directives such
* as {@link ngInclude} to download and cache templates.
*
* 3rd party modules should use `$templateRequest` if their services or directives are loading
* templates.
*
* @param {string|TrustedResourceUrl} tpl The HTTP request template URL
* @param {boolean=} ignoreRequestError Whether or not to ignore the exception when the request fails or the template is empty
*
* @return {Promise} a promise for the HTTP response data of the given URL.
*
* @property {number} totalPendingRequests total amount of pending template requests being downloaded.
*/
this.$get = ['$exceptionHandler', '$templateCache', '$http', '$q', '$sce',
function($exceptionHandler, $templateCache, $http, $q, $sce) {

function handleRequestFn(tpl, ignoreRequestError) {
 handleRequestFn.totalPendingRequests++;

 // We consider the template cache holds only trusted templates, so
 // there's no need to go through whitelisting again for keys that already
 // are included in there. This also makes AngularJS accept any script
 // directive, no matter its name. However, we still need to unwrap trusted
 // types.
 if (!isString(tpl) || isUndefined($templateCache.get(tpl))) {
   tpl = $sce.getTrustedResourceUrl(tpl);
 }

 var transformResponse = $http.defaults && $http.defaults.transformResponse;

 if (isArray(transformResponse)) {
   transformResponse = transformResponse.filter(function(transformer) {
     return transformer !== defaultHttpResponseTransform;
   });
 } else if (transformResponse === defaultHttpResponseTransform) {
   transformResponse = null;
 }

 return $http.get(tpl, extend({
     cache: $templateCache,
     transformResponse: transformResponse
   }, httpOptions))
   .finally(function() {
     handleRequestFn.totalPendingRequests--;
   })
   .then(function(response) {
     $templateCache.put(tpl, response.data);
     return response.data;
   }, handleError);

 function handleError(resp) {
   if (!ignoreRequestError) {
     resp = $templateRequestMinErr('tpload',
         'Failed to load template: {0} (HTTP status: {1} {2})',
         tpl, resp.status, resp.statusText);

     $exceptionHandler(resp);
   }

   return $q.reject(resp);
 }
}

handleRequestFn.totalPendingRequests = 0;

return handleRequestFn;
}
];
}

/** @this */
function $$TestabilityProvider() {
this.$get = ['$rootScope', '$browser', '$location',
function($rootScope,   $browser,   $location) {

/**
* @name $testability
*
* @description
* The private $$testability service provides a collection of methods for use when debugging
* or by automated test and debugging tools.
*/
var testability = {};

/**
* @name $$testability#findBindings
*
* @description
* Returns an array of elements that are bound (via ng-bind or {{}})
* to expressions matching the input.
*
* @param {Element} element The element root to search from.
* @param {string} expression The binding expression to match.
* @param {boolean} opt_exactMatch If true, only returns exact matches
*     for the expression. Filters and whitespace are ignored.
*/
testability.findBindings = function(element, expression, opt_exactMatch) {
var bindings = element.getElementsByClassName('ng-binding');
var matches = [];
forEach(bindings, function(binding) {
 var dataBinding = angular.element(binding).data('$binding');
 if (dataBinding) {
   forEach(dataBinding, function(bindingName) {
     if (opt_exactMatch) {
       var matcher = new RegExp('(^|\\s)' + escapeForRegexp(expression) + '(\\s|\\||$)');
       if (matcher.test(bindingName)) {
         matches.push(binding);
       }
     } else {
       if (bindingName.indexOf(expression) !== -1) {
         matches.push(binding);
       }
     }
   });
 }
});
return matches;
};

/**
* @name $$testability#findModels
*
* @description
* Returns an array of elements that are two-way found via ng-model to
* expressions matching the input.
*
* @param {Element} element The element root to search from.
* @param {string} expression The model expression to match.
* @param {boolean} opt_exactMatch If true, only returns exact matches
*     for the expression.
*/
testability.findModels = function(element, expression, opt_exactMatch) {
var prefixes = ['ng-', 'data-ng-', 'ng\\:'];
for (var p = 0; p < prefixes.length; ++p) {
 var attributeEquals = opt_exactMatch ? '=' : '*=';
 var selector = '[' + prefixes[p] + 'model' + attributeEquals + '"' + expression + '"]';
 var elements = element.querySelectorAll(selector);
 if (elements.length) {
   return elements;
 }
}
};

/**
* @name $$testability#getLocation
*
* @description
* Shortcut for getting the location in a browser agnostic way. Returns
*     the path, search, and hash. (e.g. /path?a=b#hash)
*/
testability.getLocation = function() {
return $location.url();
};

/**
* @name $$testability#setLocation
*
* @description
* Shortcut for navigating to a location without doing a full page reload.
*
* @param {string} url The location url (path, search and hash,
*     e.g. /path?a=b#hash) to go to.
*/
testability.setLocation = function(url) {
if (url !== $location.url()) {
 $location.url(url);
 $rootScope.$digest();
}
};

/**
* @name $$testability#whenStable
*
* @description
* Calls the callback when $timeout and $http requests are completed.
*
* @param {function} callback
*/
testability.whenStable = function(callback) {
$browser.notifyWhenNoOutstandingRequests(callback);
};

return testability;
}];
}

/** @this */
function $TimeoutProvider() {
this.$get = ['$rootScope', '$browser', '$q', '$$q', '$exceptionHandler',
function($rootScope,   $browser,   $q,   $$q,   $exceptionHandler) {

var deferreds = {};


/**
* @ngdoc service
* @name $timeout
*
* @description
* AngularJS's wrapper for `window.setTimeout`. The `fn` function is wrapped into a try/catch
* block and delegates any exceptions to
* {@link ng.$exceptionHandler $exceptionHandler} service.
*
* The return value of calling `$timeout` is a promise, which will be resolved when
* the delay has passed and the timeout function, if provided, is executed.
*
* To cancel a timeout request, call `$timeout.cancel(promise)`.
*
* In tests you can use {@link ngMock.$timeout `$timeout.flush()`} to
* synchronously flush the queue of deferred functions.
*
* If you only want a promise that will be resolved after some specified delay
* then you can call `$timeout` without the `fn` function.
*
* @param {function()=} fn A function, whose execution should be delayed.
* @param {number=} [delay=0] Delay in milliseconds.
* @param {boolean=} [invokeApply=true] If set to `false` skips model dirty checking, otherwise
*   will invoke `fn` within the {@link ng.$rootScope.Scope#$apply $apply} block.
* @param {...*=} Pass additional parameters to the executed function.
* @returns {Promise} Promise that will be resolved when the timeout is reached. The promise
*   will be resolved with the return value of the `fn` function.
*
*/
function timeout(fn, delay, invokeApply) {
if (!isFunction(fn)) {
 invokeApply = delay;
 delay = fn;
 fn = noop;
}

var args = sliceArgs(arguments, 3),
   skipApply = (isDefined(invokeApply) && !invokeApply),
   deferred = (skipApply ? $$q : $q).defer(),
   promise = deferred.promise,
   timeoutId;

timeoutId = $browser.defer(function() {
 try {
   deferred.resolve(fn.apply(null, args));
 } catch (e) {
   deferred.reject(e);
   $exceptionHandler(e);
 } finally {
   delete deferreds[promise.$$timeoutId];
 }

 if (!skipApply) $rootScope.$apply();
}, delay);

promise.$$timeoutId = timeoutId;
deferreds[timeoutId] = deferred;

return promise;
}


/**
* @ngdoc method
* @name $timeout#cancel
*
* @description
* Cancels a task associated with the `promise`. As a result of this, the promise will be
* resolved with a rejection.
*
* @param {Promise=} promise Promise returned by the `$timeout` function.
* @returns {boolean} Returns `true` if the task hasn't executed yet and was successfully
*   canceled.
*/
timeout.cancel = function(promise) {
if (promise && promise.$$timeoutId in deferreds) {
 // Timeout cancels should not report an unhandled promise.
 markQExceptionHandled(deferreds[promise.$$timeoutId].promise);
 deferreds[promise.$$timeoutId].reject('canceled');
 delete deferreds[promise.$$timeoutId];
 return $browser.defer.cancel(promise.$$timeoutId);
}
return false;
};

return timeout;
}];
}

// NOTE:  The usage of window and document instead of $window and $document here is
// deliberate.  This service depends on the specific behavior of anchor nodes created by the
// browser (resolving and parsing URLs) that is unlikely to be provided by mock objects and
// cause us to break tests.  In addition, when the browser resolves a URL for XHR, it
// doesn't know about mocked locations and resolves URLs to the real document - which is
// exactly the behavior needed here.  There is little value is mocking these out for this
// service.
var urlParsingNode = window.document.createElement('a');
var originUrl = urlResolve(window.location.href);


/**
*
* Implementation Notes for non-IE browsers
* ----------------------------------------
* Assigning a URL to the href property of an anchor DOM node, even one attached to the DOM,
* results both in the normalizing and parsing of the URL.  Normalizing means that a relative
* URL will be resolved into an absolute URL in the context of the application document.
* Parsing means that the anchor node's host, hostname, protocol, port, pathname and related
* properties are all populated to reflect the normalized URL.  This approach has wide
* compatibility - Safari 1+, Mozilla 1+ etc.  See
* http://www.aptana.com/reference/html/api/HTMLAnchorElement.html
*
* Implementation Notes for IE
* ---------------------------
* IE <= 10 normalizes the URL when assigned to the anchor node similar to the other
* browsers.  However, the parsed components will not be set if the URL assigned did not specify
* them.  (e.g. if you assign a.href = "foo", then a.protocol, a.host, etc. will be empty.)  We
* work around that by performing the parsing in a 2nd step by taking a previously normalized
* URL (e.g. by assigning to a.href) and assigning it a.href again.  This correctly populates the
* properties such as protocol, hostname, port, etc.
*
* References:
*   http://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement
*   http://www.aptana.com/reference/html/api/HTMLAnchorElement.html
*   http://url.spec.whatwg.org/#urlutils
*   https://github.com/angular/angular.js/pull/2902
*   http://james.padolsey.com/javascript/parsing-urls-with-the-dom/
*
* @kind function
* @param {string} url The URL to be parsed.
* @description Normalizes and parses a URL.
* @returns {object} Returns the normalized URL as a dictionary.
*
*   | member name   | Description    |
*   |---------------|----------------|
*   | href          | A normalized version of the provided URL if it was not an absolute URL |
*   | protocol      | The protocol including the trailing colon                              |
*   | host          | The host and port (if the port is non-default) of the normalizedUrl    |
*   | search        | The search params, minus the question mark                             |
*   | hash          | The hash string, minus the hash symbol
*   | hostname      | The hostname
*   | port          | The port, without ":"
*   | pathname      | The pathname, beginning with "/"
*
*/
function urlResolve(url) {
var href = url;

// Support: IE 9-11 only
if (msie) {
// Normalize before parse.  Refer Implementation Notes on why this is
// done in two steps on IE.
urlParsingNode.setAttribute('href', href);
href = urlParsingNode.href;
}

urlParsingNode.setAttribute('href', href);

// urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
return {
href: urlParsingNode.href,
protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
host: urlParsingNode.host,
search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
hostname: urlParsingNode.hostname,
port: urlParsingNode.port,
pathname: (urlParsingNode.pathname.charAt(0) === '/')
  ? urlParsingNode.pathname
  : '/' + urlParsingNode.pathname
};
}

/**
* Parse a request URL and determine whether this is a same-origin request as the application document.
*
* @param {string|object} requestUrl The url of the request as a string that will be resolved
* or a parsed URL object.
* @returns {boolean} Whether the request is for the same origin as the application document.
*/
function urlIsSameOrigin(requestUrl) {
var parsed = (isString(requestUrl)) ? urlResolve(requestUrl) : requestUrl;
return (parsed.protocol === originUrl.protocol &&
      parsed.host === originUrl.host);
}

/**
* @ngdoc service
* @name $window
* @this
*
* @description
* A reference to the browser's `window` object. While `window`
* is globally available in JavaScript, it causes testability problems, because
* it is a global variable. In AngularJS we always refer to it through the
* `$window` service, so it may be overridden, removed or mocked for testing.
*
* Expressions, like the one defined for the `ngClick` directive in the example
* below, are evaluated with respect to the current scope.  Therefore, there is
* no risk of inadvertently coding in a dependency on a global value in such an
* expression.
*
* @example
<example module="windowExample" name="window-service">
 <file name="index.html">
   <script>
     angular.module('windowExample', [])
       .controller('ExampleController', ['$scope', '$window', function($scope, $window) {
         $scope.greeting = 'Hello, World!';
         $scope.doGreeting = function(greeting) {
           $window.alert(greeting);
         };
       }]);
   </script>
   <div ng-controller="ExampleController">
     <input type="text" ng-model="greeting" aria-label="greeting" />
     <button ng-click="doGreeting(greeting)">ALERT</button>
   </div>
 </file>
 <file name="protractor.js" type="protractor">
  it('should display the greeting in the input box', function() {
   element(by.model('greeting')).sendKeys('Hello, E2E Tests');
   // If we click the button it will block the test runner
   // element(':button').click();
  });
 </file>
</example>
*/
function $WindowProvider() {
this.$get = valueFn(window);
}

/**
* @name $$cookieReader
* @requires $document
*
* @description
* This is a private service for reading cookies used by $http and ngCookies
*
* @return {Object} a key/value map of the current cookies
*/
function $$CookieReader($document) {
var rawDocument = $document[0] || {};
var lastCookies = {};
var lastCookieString = '';

function safeGetCookie(rawDocument) {
try {
  return rawDocument.cookie || '';
} catch (e) {
  return '';
}
}

function safeDecodeURIComponent(str) {
try {
  return decodeURIComponent(str);
} catch (e) {
  return str;
}
}

return function() {
var cookieArray, cookie, i, index, name;
var currentCookieString = safeGetCookie(rawDocument);

if (currentCookieString !== lastCookieString) {
  lastCookieString = currentCookieString;
  cookieArray = lastCookieString.split('; ');
  lastCookies = {};

  for (i = 0; i < cookieArray.length; i++) {
    cookie = cookieArray[i];
    index = cookie.indexOf('=');
    if (index > 0) { //ignore nameless cookies
      name = safeDecodeURIComponent(cookie.substring(0, index));
      // the first value that is seen for a cookie is the most
      // specific one.  values for the same cookie name that
      // follow are for less specific paths.
      if (isUndefined(lastCookies[name])) {
        lastCookies[name] = safeDecodeURIComponent(cookie.substring(index + 1));
      }
    }
  }
}
return lastCookies;
};
}

$$CookieReader.$inject = ['$document'];

/** @this */
function $$CookieReaderProvider() {
this.$get = $$CookieReader;
}

/* global currencyFilter: true,
dateFilter: true,
filterFilter: true,
jsonFilter: true,
limitToFilter: true,
lowercaseFilter: true,
numberFilter: true,
orderByFilter: true,
uppercaseFilter: true,
*/

/**
* @ngdoc provider
* @name $filterProvider
* @description
*
* Filters are just functions which transform input to an output. However filters need to be
* Dependency Injected. To achieve this a filter definition consists of a factory function which is
* annotated with dependencies and is responsible for creating a filter function.
*
* <div class="alert alert-warning">
* **Note:** Filter names must be valid AngularJS {@link expression} identifiers, such as `uppercase` or `orderBy`.
* Names with special characters, such as hyphens and dots, are not allowed. If you wish to namespace
* your filters, then you can use capitalization (`myappSubsectionFilterx`) or underscores
* (`myapp_subsection_filterx`).
* </div>
*
* ```js
*   // Filter registration
*   function MyModule($provide, $filterProvider) {
*     // create a service to demonstrate injection (not always needed)
*     $provide.value('greet', function(name){
*       return 'Hello ' + name + '!';
*     });
*
*     // register a filter factory which uses the
*     // greet service to demonstrate DI.
*     $filterProvider.register('greet', function(greet){
*       // return the filter function which uses the greet service
*       // to generate salutation
*       return function(text) {
*         // filters need to be forgiving so check input validity
*         return text && greet(text) || text;
*       };
*     });
*   }
* ```
*
* The filter function is registered with the `$injector` under the filter name suffix with
* `Filter`.
*
* ```js
*   it('should be the same instance', inject(
*     function($filterProvider) {
*       $filterProvider.register('reverse', function(){
*         return ...;
*       });
*     },
*     function($filter, reverseFilter) {
*       expect($filter('reverse')).toBe(reverseFilter);
*     });
* ```
*
*
* For more information about how AngularJS filters work, and how to create your own filters, see
* {@link guide/filter Filters} in the AngularJS Developer Guide.
*/

/**
* @ngdoc service
* @name $filter
* @kind function
* @description
* Filters are used for formatting data displayed to the user.
*
* They can be used in view templates, controllers or services. AngularJS comes
* with a collection of [built-in filters](api/ng/filter), but it is easy to
* define your own as well.
*
* The general syntax in templates is as follows:
*
* ```html
* {{ expression [| filter_name[:parameter_value] ... ] }}
* ```
*
* @param {String} name Name of the filter function to retrieve
* @return {Function} the filter function
* @example
<example name="$filter" module="filterExample">
 <file name="index.html">
   <div ng-controller="MainCtrl">
    <h3>{{ originalText }}</h3>
    <h3>{{ filteredText }}</h3>
   </div>
 </file>

 <file name="script.js">
  angular.module('filterExample', [])
  .controller('MainCtrl', function($scope, $filter) {
    $scope.originalText = 'hello';
    $scope.filteredText = $filter('uppercase')($scope.originalText);
  });
 </file>
</example>
*/
$FilterProvider.$inject = ['$provide'];
/** @this */
function $FilterProvider($provide) {
var suffix = 'Filter';

/**
* @ngdoc method
* @name $filterProvider#register
* @param {string|Object} name Name of the filter function, or an object map of filters where
*    the keys are the filter names and the values are the filter factories.
*
*    <div class="alert alert-warning">
*    **Note:** Filter names must be valid AngularJS {@link expression} identifiers, such as `uppercase` or `orderBy`.
*    Names with special characters, such as hyphens and dots, are not allowed. If you wish to namespace
*    your filters, then you can use capitalization (`myappSubsectionFilterx`) or underscores
*    (`myapp_subsection_filterx`).
*    </div>
* @param {Function} factory If the first argument was a string, a factory function for the filter to be registered.
* @returns {Object} Registered filter instance, or if a map of filters was provided then a map
*    of the registered filter instances.
*/
function register(name, factory) {
if (isObject(name)) {
  var filters = {};
  forEach(name, function(filter, key) {
    filters[key] = register(key, filter);
  });
  return filters;
} else {
  return $provide.factory(name + suffix, factory);
}
}
this.register = register;

this.$get = ['$injector', function($injector) {
return function(name) {
  return $injector.get(name + suffix);
};
}];

////////////////////////////////////////

/* global
currencyFilter: false,
dateFilter: false,
filterFilter: false,
jsonFilter: false,
limitToFilter: false,
lowercaseFilter: false,
numberFilter: false,
orderByFilter: false,
uppercaseFilter: false
*/

register('currency', currencyFilter);
register('date', dateFilter);
register('filter', filterFilter);
register('json', jsonFilter);
register('limitTo', limitToFilter);
register('lowercase', lowercaseFilter);
register('number', numberFilter);
register('orderBy', orderByFilter);
register('uppercase', uppercaseFilter);
}

/**
* @ngdoc filter
* @name filter
* @kind function
*
* @description
* Selects a subset of items from `array` and returns it as a new array.
*
* @param {Array} array The source array.
* <div class="alert alert-info">
*   **Note**: If the array contains objects that reference themselves, filtering is not possible.
* </div>
* @param {string|Object|function()} expression The predicate to be used for selecting items from
*   `array`.
*
*   Can be one of:
*
*   - `string`: The string is used for matching against the contents of the `array`. All strings or
*     objects with string properties in `array` that match this string will be returned. This also
*     applies to nested object properties.
*     The predicate can be negated by prefixing the string with `!`.
*
*   - `Object`: A pattern object can be used to filter specific properties on objects contained
*     by `array`. For example `{name:"M", phone:"1"}` predicate will return an array of items
*     which have property `name` containing "M" and property `phone` containing "1". A special
*     property name (`$` by default) can be used (e.g. as in `{$: "text"}`) to accept a match
*     against any property of the object or its nested object properties. That's equivalent to the
*     simple substring match with a `string` as described above. The special property name can be
*     overwritten, using the `anyPropertyKey` parameter.
*     The predicate can be negated by prefixing the string with `!`.
*     For example `{name: "!M"}` predicate will return an array of items which have property `name`
*     not containing "M".
*
*     Note that a named property will match properties on the same level only, while the special
*     `$` property will match properties on the same level or deeper. E.g. an array item like
*     `{name: {first: 'John', last: 'Doe'}}` will **not** be matched by `{name: 'John'}`, but
*     **will** be matched by `{$: 'John'}`.
*
*   - `function(value, index, array)`: A predicate function can be used to write arbitrary filters.
*     The function is called for each element of the array, with the element, its index, and
*     the entire array itself as arguments.
*
*     The final result is an array of those elements that the predicate returned true for.
*
* @param {function(actual, expected)|true|false} [comparator] Comparator which is used in
*     determining if values retrieved using `expression` (when it is not a function) should be
*     considered a match based on the expected value (from the filter expression) and actual
*     value (from the object in the array).
*
*   Can be one of:
*
*   - `function(actual, expected)`:
*     The function will be given the object value and the predicate value to compare and
*     should return true if both values should be considered equal.
*
*   - `true`: A shorthand for `function(actual, expected) { return angular.equals(actual, expected)}`.
*     This is essentially strict comparison of expected and actual.
*
*   - `false`: A short hand for a function which will look for a substring match in a case
*     insensitive way. Primitive values are converted to strings. Objects are not compared against
*     primitives, unless they have a custom `toString` method (e.g. `Date` objects).
*
*
*   Defaults to `false`.
*
* @param {string} [anyPropertyKey] The special property name that matches against any property.
*     By default `$`.
*
* @example
<example name="filter-filter">
 <file name="index.html">
   <div ng-init="friends = [{name:'John', phone:'555-1276'},
                            {name:'Mary', phone:'800-BIG-MARY'},
                            {name:'Mike', phone:'555-4321'},
                            {name:'Adam', phone:'555-5678'},
                            {name:'Julie', phone:'555-8765'},
                            {name:'Juliette', phone:'555-5678'}]"></div>

   <label>Search: <input ng-model="searchText"></label>
   <table id="searchTextResults">
     <tr><th>Name</th><th>Phone</th></tr>
     <tr ng-repeat="friend in friends | filter:searchText">
       <td>{{friend.name}}</td>
       <td>{{friend.phone}}</td>
     </tr>
   </table>
   <hr>
   <label>Any: <input ng-model="search.$"></label> <br>
   <label>Name only <input ng-model="search.name"></label><br>
   <label>Phone only <input ng-model="search.phone"></label><br>
   <label>Equality <input type="checkbox" ng-model="strict"></label><br>
   <table id="searchObjResults">
     <tr><th>Name</th><th>Phone</th></tr>
     <tr ng-repeat="friendObj in friends | filter:search:strict">
       <td>{{friendObj.name}}</td>
       <td>{{friendObj.phone}}</td>
     </tr>
   </table>
 </file>
 <file name="protractor.js" type="protractor">
   var expectFriendNames = function(expectedNames, key) {
     element.all(by.repeater(key + ' in friends').column(key + '.name')).then(function(arr) {
       arr.forEach(function(wd, i) {
         expect(wd.getText()).toMatch(expectedNames[i]);
       });
     });
   };

   it('should search across all fields when filtering with a string', function() {
     var searchText = element(by.model('searchText'));
     searchText.clear();
     searchText.sendKeys('m');
     expectFriendNames(['Mary', 'Mike', 'Adam'], 'friend');

     searchText.clear();
     searchText.sendKeys('76');
     expectFriendNames(['John', 'Julie'], 'friend');
   });

   it('should search in specific fields when filtering with a predicate object', function() {
     var searchAny = element(by.model('search.$'));
     searchAny.clear();
     searchAny.sendKeys('i');
     expectFriendNames(['Mary', 'Mike', 'Julie', 'Juliette'], 'friendObj');
   });
   it('should use a equal comparison when comparator is true', function() {
     var searchName = element(by.model('search.name'));
     var strict = element(by.model('strict'));
     searchName.clear();
     searchName.sendKeys('Julie');
     strict.click();
     expectFriendNames(['Julie'], 'friendObj');
   });
 </file>
</example>
*/

function filterFilter() {
return function(array, expression, comparator, anyPropertyKey) {
if (!isArrayLike(array)) {
  if (array == null) {
    return array;
  } else {
    throw minErr('filter')('notarray', 'Expected array but received: {0}', array);
  }
}

anyPropertyKey = anyPropertyKey || '$';
var expressionType = getTypeForFilter(expression);
var predicateFn;
var matchAgainstAnyProp;

switch (expressionType) {
  case 'function':
    predicateFn = expression;
    break;
  case 'boolean':
  case 'null':
  case 'number':
  case 'string':
    matchAgainstAnyProp = true;
    // falls through
  case 'object':
    predicateFn = createPredicateFn(expression, comparator, anyPropertyKey, matchAgainstAnyProp);
    break;
  default:
    return array;
}

return Array.prototype.filter.call(array, predicateFn);
};
}

// Helper functions for `filterFilter`
function createPredicateFn(expression, comparator, anyPropertyKey, matchAgainstAnyProp) {
var shouldMatchPrimitives = isObject(expression) && (anyPropertyKey in expression);
var predicateFn;

if (comparator === true) {
comparator = equals;
} else if (!isFunction(comparator)) {
comparator = function(actual, expected) {
  if (isUndefined(actual)) {
    // No substring matching against `undefined`
    return false;
  }
  if ((actual === null) || (expected === null)) {
    // No substring matching against `null`; only match against `null`
    return actual === expected;
  }
  if (isObject(expected) || (isObject(actual) && !hasCustomToString(actual))) {
    // Should not compare primitives against objects, unless they have custom `toString` method
    return false;
  }

  actual = lowercase('' + actual);
  expected = lowercase('' + expected);
  return actual.indexOf(expected) !== -1;
};
}

predicateFn = function(item) {
if (shouldMatchPrimitives && !isObject(item)) {
  return deepCompare(item, expression[anyPropertyKey], comparator, anyPropertyKey, false);
}
return deepCompare(item, expression, comparator, anyPropertyKey, matchAgainstAnyProp);
};

return predicateFn;
}

function deepCompare(actual, expected, comparator, anyPropertyKey, matchAgainstAnyProp, dontMatchWholeObject) {
var actualType = getTypeForFilter(actual);
var expectedType = getTypeForFilter(expected);

if ((expectedType === 'string') && (expected.charAt(0) === '!')) {
return !deepCompare(actual, expected.substring(1), comparator, anyPropertyKey, matchAgainstAnyProp);
} else if (isArray(actual)) {
// In case `actual` is an array, consider it a match
// if ANY of it's items matches `expected`
return actual.some(function(item) {
  return deepCompare(item, expected, comparator, anyPropertyKey, matchAgainstAnyProp);
});
}

switch (actualType) {
case 'object':
  var key;
  if (matchAgainstAnyProp) {
    for (key in actual) {
      // Under certain, rare, circumstances, key may not be a string and `charAt` will be undefined
      // See: https://github.com/angular/angular.js/issues/15644
      if (key.charAt && (key.charAt(0) !== '$') &&
          deepCompare(actual[key], expected, comparator, anyPropertyKey, true)) {
        return true;
      }
    }
    return dontMatchWholeObject ? false : deepCompare(actual, expected, comparator, anyPropertyKey, false);
  } else if (expectedType === 'object') {
    for (key in expected) {
      var expectedVal = expected[key];
      if (isFunction(expectedVal) || isUndefined(expectedVal)) {
        continue;
      }

      var matchAnyProperty = key === anyPropertyKey;
      var actualVal = matchAnyProperty ? actual : actual[key];
      if (!deepCompare(actualVal, expectedVal, comparator, anyPropertyKey, matchAnyProperty, matchAnyProperty)) {
        return false;
      }
    }
    return true;
  } else {
    return comparator(actual, expected);
  }
case 'function':
  return false;
default:
  return comparator(actual, expected);
}
}

// Used for easily differentiating between `null` and actual `object`
function getTypeForFilter(val) {
return (val === null) ? 'null' : typeof val;
}

var MAX_DIGITS = 22;
var DECIMAL_SEP = '.';
var ZERO_CHAR = '0';

/**
* @ngdoc filter
* @name currency
* @kind function
*
* @description
* Formats a number as a currency (ie $1,234.56). When no currency symbol is provided, default
* symbol for current locale is used.
*
* @param {number} amount Input to filter.
* @param {string=} symbol Currency symbol or identifier to be displayed.
* @param {number=} fractionSize Number of decimal places to round the amount to, defaults to default max fraction size for current locale
* @returns {string} Formatted number.
*
*
* @example
<example module="currencyExample" name="currency-filter">
 <file name="index.html">
   <script>
     angular.module('currencyExample', [])
       .controller('ExampleController', ['$scope', function($scope) {
         $scope.amount = 1234.56;
       }]);
   </script>
   <div ng-controller="ExampleController">
     <input type="number" ng-model="amount" aria-label="amount"> <br>
     default currency symbol ($): <span id="currency-default">{{amount | currency}}</span><br>
     custom currency identifier (USD$): <span id="currency-custom">{{amount | currency:"USD$"}}</span><br>
     no fractions (0): <span id="currency-no-fractions">{{amount | currency:"USD$":0}}</span>
   </div>
 </file>
 <file name="protractor.js" type="protractor">
   it('should init with 1234.56', function() {
     expect(element(by.id('currency-default')).getText()).toBe('$1,234.56');
     expect(element(by.id('currency-custom')).getText()).toBe('USD$1,234.56');
     expect(element(by.id('currency-no-fractions')).getText()).toBe('USD$1,235');
   });
   it('should update', function() {
     if (browser.params.browser === 'safari') {
       // Safari does not understand the minus key. See
       // https://github.com/angular/protractor/issues/481
       return;
     }
     element(by.model('amount')).clear();
     element(by.model('amount')).sendKeys('-1234');
     expect(element(by.id('currency-default')).getText()).toBe('-$1,234.00');
     expect(element(by.id('currency-custom')).getText()).toBe('-USD$1,234.00');
     expect(element(by.id('currency-no-fractions')).getText()).toBe('-USD$1,234');
   });
 </file>
</example>
*/
currencyFilter.$inject = ['$locale'];
function currencyFilter($locale) {
var formats = $locale.NUMBER_FORMATS;
return function(amount, currencySymbol, fractionSize) {
if (isUndefined(currencySymbol)) {
  currencySymbol = formats.CURRENCY_SYM;
}

if (isUndefined(fractionSize)) {
  fractionSize = formats.PATTERNS[1].maxFrac;
}

// If the currency symbol is empty, trim whitespace around the symbol
var currencySymbolRe = !currencySymbol ? /\s*\u00A4\s*/g : /\u00A4/g;

// if null or undefined pass it through
return (amount == null)
    ? amount
    : formatNumber(amount, formats.PATTERNS[1], formats.GROUP_SEP, formats.DECIMAL_SEP, fractionSize).
        replace(currencySymbolRe, currencySymbol);
};
}

/**
* @ngdoc filter
* @name number
* @kind function
*
* @description
* Formats a number as text.
*
* If the input is null or undefined, it will just be returned.
* If the input is infinite (Infinity or -Infinity), the Infinity symbol 'âˆž' or '-âˆž' is returned, respectively.
* If the input is not a number an empty string is returned.
*
*
* @param {number|string} number Number to format.
* @param {(number|string)=} fractionSize Number of decimal places to round the number to.
* If this is not provided then the fraction size is computed from the current locale's number
* formatting pattern. In the case of the default locale, it will be 3.
* @returns {string} Number rounded to `fractionSize` appropriately formatted based on the current
*                   locale (e.g., in the en_US locale it will have "." as the decimal separator and
*                   include "," group separators after each third digit).
*
* @example
<example module="numberFilterExample" name="number-filter">
 <file name="index.html">
   <script>
     angular.module('numberFilterExample', [])
       .controller('ExampleController', ['$scope', function($scope) {
         $scope.val = 1234.56789;
       }]);
   </script>
   <div ng-controller="ExampleController">
     <label>Enter number: <input ng-model='val'></label><br>
     Default formatting: <span id='number-default'>{{val | number}}</span><br>
     No fractions: <span>{{val | number:0}}</span><br>
     Negative number: <span>{{-val | number:4}}</span>
   </div>
 </file>
 <file name="protractor.js" type="protractor">
   it('should format numbers', function() {
     expect(element(by.id('number-default')).getText()).toBe('1,234.568');
     expect(element(by.binding('val | number:0')).getText()).toBe('1,235');
     expect(element(by.binding('-val | number:4')).getText()).toBe('-1,234.5679');
   });

   it('should update', function() {
     element(by.model('val')).clear();
     element(by.model('val')).sendKeys('3374.333');
     expect(element(by.id('number-default')).getText()).toBe('3,374.333');
     expect(element(by.binding('val | number:0')).getText()).toBe('3,374');
     expect(element(by.binding('-val | number:4')).getText()).toBe('-3,374.3330');
  });
 </file>
</example>
*/
numberFilter.$inject = ['$locale'];
function numberFilter($locale) {
var formats = $locale.NUMBER_FORMATS;
return function(number, fractionSize) {

// if null or undefined pass it through
return (number == null)
    ? number
    : formatNumber(number, formats.PATTERNS[0], formats.GROUP_SEP, formats.DECIMAL_SEP,
                   fractionSize);
};
}

/**
* Parse a number (as a string) into three components that can be used
* for formatting the number.
*
* (Significant bits of this parse algorithm came from https://github.com/MikeMcl/big.js/)
*
* @param  {string} numStr The number to parse
* @return {object} An object describing this number, containing the following keys:
*  - d : an array of digits containing leading zeros as necessary
*  - i : the number of the digits in `d` that are to the left of the decimal point
*  - e : the exponent for numbers that would need more than `MAX_DIGITS` digits in `d`
*
*/
function parse(numStr) {
var exponent = 0, digits, numberOfIntegerDigits;
var i, j, zeros;

// Decimal point?
if ((numberOfIntegerDigits = numStr.indexOf(DECIMAL_SEP)) > -1) {
numStr = numStr.replace(DECIMAL_SEP, '');
}

// Exponential form?
if ((i = numStr.search(/e/i)) > 0) {
// Work out the exponent.
if (numberOfIntegerDigits < 0) numberOfIntegerDigits = i;
numberOfIntegerDigits += +numStr.slice(i + 1);
numStr = numStr.substring(0, i);
} else if (numberOfIntegerDigits < 0) {
// There was no decimal point or exponent so it is an integer.
numberOfIntegerDigits = numStr.length;
}

// Count the number of leading zeros.
for (i = 0; numStr.charAt(i) === ZERO_CHAR; i++) { /* empty */ }

if (i === (zeros = numStr.length)) {
// The digits are all zero.
digits = [0];
numberOfIntegerDigits = 1;
} else {
// Count the number of trailing zeros
zeros--;
while (numStr.charAt(zeros) === ZERO_CHAR) zeros--;

// Trailing zeros are insignificant so ignore them
numberOfIntegerDigits -= i;
digits = [];
// Convert string to array of digits without leading/trailing zeros.
for (j = 0; i <= zeros; i++, j++) {
  digits[j] = +numStr.charAt(i);
}
}

// If the number overflows the maximum allowed digits then use an exponent.
if (numberOfIntegerDigits > MAX_DIGITS) {
digits = digits.splice(0, MAX_DIGITS - 1);
exponent = numberOfIntegerDigits - 1;
numberOfIntegerDigits = 1;
}

return { d: digits, e: exponent, i: numberOfIntegerDigits };
}

/**
* Round the parsed number to the specified number of decimal places
* This function changed the parsedNumber in-place
*/
function roundNumber(parsedNumber, fractionSize, minFrac, maxFrac) {
var digits = parsedNumber.d;
var fractionLen = digits.length - parsedNumber.i;

// determine fractionSize if it is not specified; `+fractionSize` converts it to a number
fractionSize = (isUndefined(fractionSize)) ? Math.min(Math.max(minFrac, fractionLen), maxFrac) : +fractionSize;

// The index of the digit to where rounding is to occur
var roundAt = fractionSize + parsedNumber.i;
var digit = digits[roundAt];

if (roundAt > 0) {
  // Drop fractional digits beyond `roundAt`
  digits.splice(Math.max(parsedNumber.i, roundAt));

  // Set non-fractional digits beyond `roundAt` to 0
  for (var j = roundAt; j < digits.length; j++) {
    digits[j] = 0;
  }
} else {
  // We rounded to zero so reset the parsedNumber
  fractionLen = Math.max(0, fractionLen);
  parsedNumber.i = 1;
  digits.length = Math.max(1, roundAt = fractionSize + 1);
  digits[0] = 0;
  for (var i = 1; i < roundAt; i++) digits[i] = 0;
}

if (digit >= 5) {
  if (roundAt - 1 < 0) {
    for (var k = 0; k > roundAt; k--) {
      digits.unshift(0);
      parsedNumber.i++;
    }
    digits.unshift(1);
    parsedNumber.i++;
  } else {
    digits[roundAt - 1]++;
  }
}

// Pad out with zeros to get the required fraction length
for (; fractionLen < Math.max(0, fractionSize); fractionLen++) digits.push(0);


// Do any carrying, e.g. a digit was rounded up to 10
var carry = digits.reduceRight(function(carry, d, i, digits) {
  d = d + carry;
  digits[i] = d % 10;
  return Math.floor(d / 10);
}, 0);
if (carry) {
  digits.unshift(carry);
  parsedNumber.i++;
}
}

/**
* Format a number into a string
* @param  {number} number       The number to format
* @param  {{
*           minFrac, // the minimum number of digits required in the fraction part of the number
*           maxFrac, // the maximum number of digits required in the fraction part of the number
*           gSize,   // number of digits in each group of separated digits
*           lgSize,  // number of digits in the last group of digits before the decimal separator
*           negPre,  // the string to go in front of a negative number (e.g. `-` or `(`))
*           posPre,  // the string to go in front of a positive number
*           negSuf,  // the string to go after a negative number (e.g. `)`)
*           posSuf   // the string to go after a positive number
*         }} pattern
* @param  {string} groupSep     The string to separate groups of number (e.g. `,`)
* @param  {string} decimalSep   The string to act as the decimal separator (e.g. `.`)
* @param  {[type]} fractionSize The size of the fractional part of the number
* @return {string}              The number formatted as a string
*/
function formatNumber(number, pattern, groupSep, decimalSep, fractionSize) {

if (!(isString(number) || isNumber(number)) || isNaN(number)) return '';

var isInfinity = !isFinite(number);
var isZero = false;
var numStr = Math.abs(number) + '',
  formattedText = '',
  parsedNumber;

if (isInfinity) {
formattedText = '\u221e';
} else {
parsedNumber = parse(numStr);

roundNumber(parsedNumber, fractionSize, pattern.minFrac, pattern.maxFrac);

var digits = parsedNumber.d;
var integerLen = parsedNumber.i;
var exponent = parsedNumber.e;
var decimals = [];
isZero = digits.reduce(function(isZero, d) { return isZero && !d; }, true);

// pad zeros for small numbers
while (integerLen < 0) {
  digits.unshift(0);
  integerLen++;
}

// extract decimals digits
if (integerLen > 0) {
  decimals = digits.splice(integerLen, digits.length);
} else {
  decimals = digits;
  digits = [0];
}

// format the integer digits with grouping separators
var groups = [];
if (digits.length >= pattern.lgSize) {
  groups.unshift(digits.splice(-pattern.lgSize, digits.length).join(''));
}
while (digits.length > pattern.gSize) {
  groups.unshift(digits.splice(-pattern.gSize, digits.length).join(''));
}
if (digits.length) {
  groups.unshift(digits.join(''));
}
formattedText = groups.join(groupSep);

// append the decimal digits
if (decimals.length) {
  formattedText += decimalSep + decimals.join('');
}

if (exponent) {
  formattedText += 'e+' + exponent;
}
}
if (number < 0 && !isZero) {
return pattern.negPre + formattedText + pattern.negSuf;
} else {
return pattern.posPre + formattedText + pattern.posSuf;
}
}

function padNumber(num, digits, trim, negWrap) {
var neg = '';
if (num < 0 || (negWrap && num <= 0)) {
if (negWrap) {
  num = -num + 1;
} else {
  num = -num;
  neg = '-';
}
}
num = '' + num;
while (num.length < digits) num = ZERO_CHAR + num;
if (trim) {
num = num.substr(num.length - digits);
}
return neg + num;
}


function dateGetter(name, size, offset, trim, negWrap) {
offset = offset || 0;
return function(date) {
var value = date['get' + name]();
if (offset > 0 || value > -offset) {
  value += offset;
}
if (value === 0 && offset === -12) value = 12;
return padNumber(value, size, trim, negWrap);
};
}

function dateStrGetter(name, shortForm, standAlone) {
return function(date, formats) {
var value = date['get' + name]();
var propPrefix = (standAlone ? 'STANDALONE' : '') + (shortForm ? 'SHORT' : '');
var get = uppercase(propPrefix + name);

return formats[get][value];
};
}

function timeZoneGetter(date, formats, offset) {
var zone = -1 * offset;
var paddedZone = (zone >= 0) ? '+' : '';

paddedZone += padNumber(Math[zone > 0 ? 'floor' : 'ceil'](zone / 60), 2) +
            padNumber(Math.abs(zone % 60), 2);

return paddedZone;
}

function getFirstThursdayOfYear(year) {
// 0 = index of January
var dayOfWeekOnFirst = (new Date(year, 0, 1)).getDay();
// 4 = index of Thursday (+1 to account for 1st = 5)
// 11 = index of *next* Thursday (+1 account for 1st = 12)
return new Date(year, 0, ((dayOfWeekOnFirst <= 4) ? 5 : 12) - dayOfWeekOnFirst);
}

function getThursdayThisWeek(datetime) {
return new Date(datetime.getFullYear(), datetime.getMonth(),
  // 4 = index of Thursday
  datetime.getDate() + (4 - datetime.getDay()));
}

function weekGetter(size) {
return function(date) {
  var firstThurs = getFirstThursdayOfYear(date.getFullYear()),
     thisThurs = getThursdayThisWeek(date);

  var diff = +thisThurs - +firstThurs,
     result = 1 + Math.round(diff / 6.048e8); // 6.048e8 ms per week

  return padNumber(result, size);
};
}

function ampmGetter(date, formats) {
return date.getHours() < 12 ? formats.AMPMS[0] : formats.AMPMS[1];
}

function eraGetter(date, formats) {
return date.getFullYear() <= 0 ? formats.ERAS[0] : formats.ERAS[1];
}

function longEraGetter(date, formats) {
return date.getFullYear() <= 0 ? formats.ERANAMES[0] : formats.ERANAMES[1];
}

var DATE_FORMATS = {
yyyy: dateGetter('FullYear', 4, 0, false, true),
yy: dateGetter('FullYear', 2, 0, true, true),
 y: dateGetter('FullYear', 1, 0, false, true),
MMMM: dateStrGetter('Month'),
MMM: dateStrGetter('Month', true),
MM: dateGetter('Month', 2, 1),
 M: dateGetter('Month', 1, 1),
LLLL: dateStrGetter('Month', false, true),
dd: dateGetter('Date', 2),
 d: dateGetter('Date', 1),
HH: dateGetter('Hours', 2),
 H: dateGetter('Hours', 1),
hh: dateGetter('Hours', 2, -12),
 h: dateGetter('Hours', 1, -12),
mm: dateGetter('Minutes', 2),
 m: dateGetter('Minutes', 1),
ss: dateGetter('Seconds', 2),
 s: dateGetter('Seconds', 1),
 // while ISO 8601 requires fractions to be prefixed with `.` or `,`
 // we can be just safely rely on using `sss` since we currently don't support single or two digit fractions
sss: dateGetter('Milliseconds', 3),
EEEE: dateStrGetter('Day'),
EEE: dateStrGetter('Day', true),
 a: ampmGetter,
 Z: timeZoneGetter,
ww: weekGetter(2),
 w: weekGetter(1),
 G: eraGetter,
 GG: eraGetter,
 GGG: eraGetter,
 GGGG: longEraGetter
};

var DATE_FORMATS_SPLIT = /((?:[^yMLdHhmsaZEwG']+)|(?:'(?:[^']|'')*')|(?:E+|y+|M+|L+|d+|H+|h+|m+|s+|a|Z|G+|w+))([\s\S]*)/,
NUMBER_STRING = /^-?\d+$/;

/**
* @ngdoc filter
* @name date
* @kind function
*
* @description
*   Formats `date` to a string based on the requested `format`.
*
*   `format` string can be composed of the following elements:
*
*   * `'yyyy'`: 4 digit representation of year (e.g. AD 1 => 0001, AD 2010 => 2010)
*   * `'yy'`: 2 digit representation of year, padded (00-99). (e.g. AD 2001 => 01, AD 2010 => 10)
*   * `'y'`: 1 digit representation of year, e.g. (AD 1 => 1, AD 199 => 199)
*   * `'MMMM'`: Month in year (January-December)
*   * `'MMM'`: Month in year (Jan-Dec)
*   * `'MM'`: Month in year, padded (01-12)
*   * `'M'`: Month in year (1-12)
*   * `'LLLL'`: Stand-alone month in year (January-December)
*   * `'dd'`: Day in month, padded (01-31)
*   * `'d'`: Day in month (1-31)
*   * `'EEEE'`: Day in Week,(Sunday-Saturday)
*   * `'EEE'`: Day in Week, (Sun-Sat)
*   * `'HH'`: Hour in day, padded (00-23)
*   * `'H'`: Hour in day (0-23)
*   * `'hh'`: Hour in AM/PM, padded (01-12)
*   * `'h'`: Hour in AM/PM, (1-12)
*   * `'mm'`: Minute in hour, padded (00-59)
*   * `'m'`: Minute in hour (0-59)
*   * `'ss'`: Second in minute, padded (00-59)
*   * `'s'`: Second in minute (0-59)
*   * `'sss'`: Millisecond in second, padded (000-999)
*   * `'a'`: AM/PM marker
*   * `'Z'`: 4 digit (+sign) representation of the timezone offset (-1200-+1200)
*   * `'ww'`: Week of year, padded (00-53). Week 01 is the week with the first Thursday of the year
*   * `'w'`: Week of year (0-53). Week 1 is the week with the first Thursday of the year
*   * `'G'`, `'GG'`, `'GGG'`: The abbreviated form of the era string (e.g. 'AD')
*   * `'GGGG'`: The long form of the era string (e.g. 'Anno Domini')
*
*   `format` string can also be one of the following predefined
*   {@link guide/i18n localizable formats}:
*
*   * `'medium'`: equivalent to `'MMM d, y h:mm:ss a'` for en_US locale
*     (e.g. Sep 3, 2010 12:05:08 PM)
*   * `'short'`: equivalent to `'M/d/yy h:mm a'` for en_US  locale (e.g. 9/3/10 12:05 PM)
*   * `'fullDate'`: equivalent to `'EEEE, MMMM d, y'` for en_US  locale
*     (e.g. Friday, September 3, 2010)
*   * `'longDate'`: equivalent to `'MMMM d, y'` for en_US  locale (e.g. September 3, 2010)
*   * `'mediumDate'`: equivalent to `'MMM d, y'` for en_US  locale (e.g. Sep 3, 2010)
*   * `'shortDate'`: equivalent to `'M/d/yy'` for en_US locale (e.g. 9/3/10)
*   * `'mediumTime'`: equivalent to `'h:mm:ss a'` for en_US locale (e.g. 12:05:08 PM)
*   * `'shortTime'`: equivalent to `'h:mm a'` for en_US locale (e.g. 12:05 PM)
*
*   `format` string can contain literal values. These need to be escaped by surrounding with single quotes (e.g.
*   `"h 'in the morning'"`). In order to output a single quote, escape it - i.e., two single quotes in a sequence
*   (e.g. `"h 'o''clock'"`).
*
*   Any other characters in the `format` string will be output as-is.
*
* @param {(Date|number|string)} date Date to format either as Date object, milliseconds (string or
*    number) or various ISO 8601 datetime string formats (e.g. yyyy-MM-ddTHH:mm:ss.sssZ and its
*    shorter versions like yyyy-MM-ddTHH:mmZ, yyyy-MM-dd or yyyyMMddTHHmmssZ). If no timezone is
*    specified in the string input, the time is considered to be in the local timezone.
* @param {string=} format Formatting rules (see Description). If not specified,
*    `mediumDate` is used.
* @param {string=} timezone Timezone to be used for formatting. It understands UTC/GMT and the
*    continental US time zone abbreviations, but for general use, use a time zone offset, for
*    example, `'+0430'` (4 hours, 30 minutes east of the Greenwich meridian)
*    If not specified, the timezone of the browser will be used.
* @returns {string} Formatted string or the input if input is not recognized as date/millis.
*
* @example
<example name="filter-date">
 <file name="index.html">
   <span ng-non-bindable>{{1288323623006 | date:'medium'}}</span>:
       <span>{{1288323623006 | date:'medium'}}</span><br>
   <span ng-non-bindable>{{1288323623006 | date:'yyyy-MM-dd HH:mm:ss Z'}}</span>:
      <span>{{1288323623006 | date:'yyyy-MM-dd HH:mm:ss Z'}}</span><br>
   <span ng-non-bindable>{{1288323623006 | date:'MM/dd/yyyy @ h:mma'}}</span>:
      <span>{{'1288323623006' | date:'MM/dd/yyyy @ h:mma'}}</span><br>
   <span ng-non-bindable>{{1288323623006 | date:"MM/dd/yyyy 'at' h:mma"}}</span>:
      <span>{{'1288323623006' | date:"MM/dd/yyyy 'at' h:mma"}}</span><br>
 </file>
 <file name="protractor.js" type="protractor">
   it('should format date', function() {
     expect(element(by.binding("1288323623006 | date:'medium'")).getText()).
        toMatch(/Oct 2\d, 2010 \d{1,2}:\d{2}:\d{2} (AM|PM)/);
     expect(element(by.binding("1288323623006 | date:'yyyy-MM-dd HH:mm:ss Z'")).getText()).
        toMatch(/2010-10-2\d \d{2}:\d{2}:\d{2} (-|\+)?\d{4}/);
     expect(element(by.binding("'1288323623006' | date:'MM/dd/yyyy @ h:mma'")).getText()).
        toMatch(/10\/2\d\/2010 @ \d{1,2}:\d{2}(AM|PM)/);
     expect(element(by.binding("'1288323623006' | date:\"MM/dd/yyyy 'at' h:mma\"")).getText()).
        toMatch(/10\/2\d\/2010 at \d{1,2}:\d{2}(AM|PM)/);
   });
 </file>
</example>
*/
dateFilter.$inject = ['$locale'];
function dateFilter($locale) {


var R_ISO8601_STR = /^(\d{4})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/;
                 // 1        2       3         4          5          6          7          8  9     10      11
function jsonStringToDate(string) {
var match;
if ((match = string.match(R_ISO8601_STR))) {
  var date = new Date(0),
      tzHour = 0,
      tzMin  = 0,
      dateSetter = match[8] ? date.setUTCFullYear : date.setFullYear,
      timeSetter = match[8] ? date.setUTCHours : date.setHours;

  if (match[9]) {
    tzHour = toInt(match[9] + match[10]);
    tzMin = toInt(match[9] + match[11]);
  }
  dateSetter.call(date, toInt(match[1]), toInt(match[2]) - 1, toInt(match[3]));
  var h = toInt(match[4] || 0) - tzHour;
  var m = toInt(match[5] || 0) - tzMin;
  var s = toInt(match[6] || 0);
  var ms = Math.round(parseFloat('0.' + (match[7] || 0)) * 1000);
  timeSetter.call(date, h, m, s, ms);
  return date;
}
return string;
}


return function(date, format, timezone) {
var text = '',
    parts = [],
    fn, match;

format = format || 'mediumDate';
format = $locale.DATETIME_FORMATS[format] || format;
if (isString(date)) {
  date = NUMBER_STRING.test(date) ? toInt(date) : jsonStringToDate(date);
}

if (isNumber(date)) {
  date = new Date(date);
}

if (!isDate(date) || !isFinite(date.getTime())) {
  return date;
}

while (format) {
  match = DATE_FORMATS_SPLIT.exec(format);
  if (match) {
    parts = concat(parts, match, 1);
    format = parts.pop();
  } else {
    parts.push(format);
    format = null;
  }
}

var dateTimezoneOffset = date.getTimezoneOffset();
if (timezone) {
  dateTimezoneOffset = timezoneToOffset(timezone, dateTimezoneOffset);
  date = convertTimezoneToLocal(date, timezone, true);
}
forEach(parts, function(value) {
  fn = DATE_FORMATS[value];
  text += fn ? fn(date, $locale.DATETIME_FORMATS, dateTimezoneOffset)
             : value === '\'\'' ? '\'' : value.replace(/(^'|'$)/g, '').replace(/''/g, '\'');
});

return text;
};
}


/**
* @ngdoc filter
* @name json
* @kind function
*
* @description
*   Allows you to convert a JavaScript object into JSON string.
*
*   This filter is mostly useful for debugging. When using the double curly {{value}} notation
*   the binding is automatically converted to JSON.
*
* @param {*} object Any JavaScript object (including arrays and primitive types) to filter.
* @param {number=} spacing The number of spaces to use per indentation, defaults to 2.
* @returns {string} JSON string.
*
*
* @example
<example name="filter-json">
 <file name="index.html">
   <pre id="default-spacing">{{ {'name':'value'} | json }}</pre>
   <pre id="custom-spacing">{{ {'name':'value'} | json:4 }}</pre>
 </file>
 <file name="protractor.js" type="protractor">
   it('should jsonify filtered objects', function() {
     expect(element(by.id('default-spacing')).getText()).toMatch(/\{\n {2}"name": ?"value"\n}/);
     expect(element(by.id('custom-spacing')).getText()).toMatch(/\{\n {4}"name": ?"value"\n}/);
   });
 </file>
</example>
*
*/
function jsonFilter() {
return function(object, spacing) {
if (isUndefined(spacing)) {
    spacing = 2;
}
return toJson(object, spacing);
};
}


/**
* @ngdoc filter
* @name lowercase
* @kind function
* @description
* Converts string to lowercase.
*
* See the {@link ng.uppercase uppercase filter documentation} for a functionally identical example.
*
* @see angular.lowercase
*/
var lowercaseFilter = valueFn(lowercase);


/**
* @ngdoc filter
* @name uppercase
* @kind function
* @description
* Converts string to uppercase.
* @example
<example module="uppercaseFilterExample" name="filter-uppercase">
 <file name="index.html">
   <script>
     angular.module('uppercaseFilterExample', [])
       .controller('ExampleController', ['$scope', function($scope) {
         $scope.title = 'This is a title';
       }]);
   </script>
   <div ng-controller="ExampleController">
     <!-- This title should be formatted normally -->
     <h1>{{title}}</h1>
     <!-- This title should be capitalized -->
     <h1>{{title | uppercase}}</h1>
   </div>
 </file>
</example>
*/
var uppercaseFilter = valueFn(uppercase);

/**
* @ngdoc filter
* @name limitTo
* @kind function
*
* @description
* Creates a new array or string containing only a specified number of elements. The elements are
* taken from either the beginning or the end of the source array, string or number, as specified by
* the value and sign (positive or negative) of `limit`. Other array-like objects are also supported
* (e.g. array subclasses, NodeLists, jqLite/jQuery collections etc). If a number is used as input,
* it is converted to a string.
*
* @param {Array|ArrayLike|string|number} input - Array/array-like, string or number to be limited.
* @param {string|number} limit - The length of the returned array or string. If the `limit` number
*     is positive, `limit` number of items from the beginning of the source array/string are copied.
*     If the number is negative, `limit` number  of items from the end of the source array/string
*     are copied. The `limit` will be trimmed if it exceeds `array.length`. If `limit` is undefined,
*     the input will be returned unchanged.
* @param {(string|number)=} begin - Index at which to begin limitation. As a negative index,
*     `begin` indicates an offset from the end of `input`. Defaults to `0`.
* @returns {Array|string} A new sub-array or substring of length `limit` or less if the input had
*     less than `limit` elements.
*
* @example
<example module="limitToExample" name="limit-to-filter">
 <file name="index.html">
   <script>
     angular.module('limitToExample', [])
       .controller('ExampleController', ['$scope', function($scope) {
         $scope.numbers = [1,2,3,4,5,6,7,8,9];
         $scope.letters = "abcdefghi";
         $scope.longNumber = 2345432342;
         $scope.numLimit = 3;
         $scope.letterLimit = 3;
         $scope.longNumberLimit = 3;
       }]);
   </script>
   <div ng-controller="ExampleController">
     <label>
        Limit {{numbers}} to:
        <input type="number" step="1" ng-model="numLimit">
     </label>
     <p>Output numbers: {{ numbers | limitTo:numLimit }}</p>
     <label>
        Limit {{letters}} to:
        <input type="number" step="1" ng-model="letterLimit">
     </label>
     <p>Output letters: {{ letters | limitTo:letterLimit }}</p>
     <label>
        Limit {{longNumber}} to:
        <input type="number" step="1" ng-model="longNumberLimit">
     </label>
     <p>Output long number: {{ longNumber | limitTo:longNumberLimit }}</p>
   </div>
 </file>
 <file name="protractor.js" type="protractor">
   var numLimitInput = element(by.model('numLimit'));
   var letterLimitInput = element(by.model('letterLimit'));
   var longNumberLimitInput = element(by.model('longNumberLimit'));
   var limitedNumbers = element(by.binding('numbers | limitTo:numLimit'));
   var limitedLetters = element(by.binding('letters | limitTo:letterLimit'));
   var limitedLongNumber = element(by.binding('longNumber | limitTo:longNumberLimit'));

   it('should limit the number array to first three items', function() {
     expect(numLimitInput.getAttribute('value')).toBe('3');
     expect(letterLimitInput.getAttribute('value')).toBe('3');
     expect(longNumberLimitInput.getAttribute('value')).toBe('3');
     expect(limitedNumbers.getText()).toEqual('Output numbers: [1,2,3]');
     expect(limitedLetters.getText()).toEqual('Output letters: abc');
     expect(limitedLongNumber.getText()).toEqual('Output long number: 234');
   });

   // There is a bug in safari and protractor that doesn't like the minus key
   // it('should update the output when -3 is entered', function() {
   //   numLimitInput.clear();
   //   numLimitInput.sendKeys('-3');
   //   letterLimitInput.clear();
   //   letterLimitInput.sendKeys('-3');
   //   longNumberLimitInput.clear();
   //   longNumberLimitInput.sendKeys('-3');
   //   expect(limitedNumbers.getText()).toEqual('Output numbers: [7,8,9]');
   //   expect(limitedLetters.getText()).toEqual('Output letters: ghi');
   //   expect(limitedLongNumber.getText()).toEqual('Output long number: 342');
   // });

   it('should not exceed the maximum size of input array', function() {
     numLimitInput.clear();
     numLimitInput.sendKeys('100');
     letterLimitInput.clear();
     letterLimitInput.sendKeys('100');
     longNumberLimitInput.clear();
     longNumberLimitInput.sendKeys('100');
     expect(limitedNumbers.getText()).toEqual('Output numbers: [1,2,3,4,5,6,7,8,9]');
     expect(limitedLetters.getText()).toEqual('Output letters: abcdefghi');
     expect(limitedLongNumber.getText()).toEqual('Output long number: 2345432342');
   });
 </file>
</example>
*/
function limitToFilter() {
return function(input, limit, begin) {
if (Math.abs(Number(limit)) === Infinity) {
  limit = Number(limit);
} else {
  limit = toInt(limit);
}
if (isNumberNaN(limit)) return input;

if (isNumber(input)) input = input.toString();
if (!isArrayLike(input)) return input;

begin = (!begin || isNaN(begin)) ? 0 : toInt(begin);
begin = (begin < 0) ? Math.max(0, input.length + begin) : begin;

if (limit >= 0) {
  return sliceFn(input, begin, begin + limit);
} else {
  if (begin === 0) {
    return sliceFn(input, limit, input.length);
  } else {
    return sliceFn(input, Math.max(0, begin + limit), begin);
  }
}
};
}

function sliceFn(input, begin, end) {
if (isString(input)) return input.slice(begin, end);

return slice.call(input, begin, end);
}

/**
* @ngdoc filter
* @name orderBy
* @kind function
*
* @description
* Returns an array containing the items from the specified `collection`, ordered by a `comparator`
* function based on the values computed using the `expression` predicate.
*
* For example, `[{id: 'foo'}, {id: 'bar'}] | orderBy:'id'` would result in
* `[{id: 'bar'}, {id: 'foo'}]`.
*
* The `collection` can be an Array or array-like object (e.g. NodeList, jQuery object, TypedArray,
* String, etc).
*
* The `expression` can be a single predicate, or a list of predicates each serving as a tie-breaker
* for the preceding one. The `expression` is evaluated against each item and the output is used
* for comparing with other items.
*
* You can change the sorting order by setting `reverse` to `true`. By default, items are sorted in
* ascending order.
*
* The comparison is done using the `comparator` function. If none is specified, a default, built-in
* comparator is used (see below for details - in a nutshell, it compares numbers numerically and
* strings alphabetically).
*
* ### Under the hood
*
* Ordering the specified `collection` happens in two phases:
*
* 1. All items are passed through the predicate (or predicates), and the returned values are saved
*    along with their type (`string`, `number` etc). For example, an item `{label: 'foo'}`, passed
*    through a predicate that extracts the value of the `label` property, would be transformed to:
*    ```
*    {
*      value: 'foo',
*      type: 'string',
*      index: ...
*    }
*    ```
* 2. The comparator function is used to sort the items, based on the derived values, types and
*    indices.
*
* If you use a custom comparator, it will be called with pairs of objects of the form
* `{value: ..., type: '...', index: ...}` and is expected to return `0` if the objects are equal
* (as far as the comparator is concerned), `-1` if the 1st one should be ranked higher than the
* second, or `1` otherwise.
*
* In order to ensure that the sorting will be deterministic across platforms, if none of the
* specified predicates can distinguish between two items, `orderBy` will automatically introduce a
* dummy predicate that returns the item's index as `value`.
* (If you are using a custom comparator, make sure it can handle this predicate as well.)
*
* If a custom comparator still can't distinguish between two items, then they will be sorted based
* on their index using the built-in comparator.
*
* Finally, in an attempt to simplify things, if a predicate returns an object as the extracted
* value for an item, `orderBy` will try to convert that object to a primitive value, before passing
* it to the comparator. The following rules govern the conversion:
*
* 1. If the object has a `valueOf()` method that returns a primitive, its return value will be
*    used instead.<br />
*    (If the object has a `valueOf()` method that returns another object, then the returned object
*    will be used in subsequent steps.)
* 2. If the object has a custom `toString()` method (i.e. not the one inherited from `Object`) that
*    returns a primitive, its return value will be used instead.<br />
*    (If the object has a `toString()` method that returns another object, then the returned object
*    will be used in subsequent steps.)
* 3. No conversion; the object itself is used.
*
* ### The default comparator
*
* The default, built-in comparator should be sufficient for most usecases. In short, it compares
* numbers numerically, strings alphabetically (and case-insensitively), for objects falls back to
* using their index in the original collection, and sorts values of different types by type.
*
* More specifically, it follows these steps to determine the relative order of items:
*
* 1. If the compared values are of different types, compare the types themselves alphabetically.
* 2. If both values are of type `string`, compare them alphabetically in a case- and
*    locale-insensitive way.
* 3. If both values are objects, compare their indices instead.
* 4. Otherwise, return:
*    -  `0`, if the values are equal (by strict equality comparison, i.e. using `===`).
*    - `-1`, if the 1st value is "less than" the 2nd value (compared using the `<` operator).
*    -  `1`, otherwise.
*
* **Note:** If you notice numbers not being sorted as expected, make sure they are actually being
*           saved as numbers and not strings.
* **Note:** For the purpose of sorting, `null` values are treated as the string `'null'` (i.e.
*           `type: 'string'`, `value: 'null'`). This may cause unexpected sort order relative to
*           other values.
*
* @param {Array|ArrayLike} collection - The collection (array or array-like object) to sort.
* @param {(Function|string|Array.<Function|string>)=} expression - A predicate (or list of
*    predicates) to be used by the comparator to determine the order of elements.
*
*    Can be one of:
*
*    - `Function`: A getter function. This function will be called with each item as argument and
*      the return value will be used for sorting.
*    - `string`: An AngularJS expression. This expression will be evaluated against each item and the
*      result will be used for sorting. For example, use `'label'` to sort by a property called
*      `label` or `'label.substring(0, 3)'` to sort by the first 3 characters of the `label`
*      property.<br />
*      (The result of a constant expression is interpreted as a property name to be used for
*      comparison. For example, use `'"special name"'` (note the extra pair of quotes) to sort by a
*      property called `special name`.)<br />
*      An expression can be optionally prefixed with `+` or `-` to control the sorting direction,
*      ascending or descending. For example, `'+label'` or `'-label'`. If no property is provided,
*      (e.g. `'+'` or `'-'`), the collection element itself is used in comparisons.
*    - `Array`: An array of function and/or string predicates. If a predicate cannot determine the
*      relative order of two items, the next predicate is used as a tie-breaker.
*
* **Note:** If the predicate is missing or empty then it defaults to `'+'`.
*
* @param {boolean=} reverse - If `true`, reverse the sorting order.
* @param {(Function)=} comparator - The comparator function used to determine the relative order of
*    value pairs. If omitted, the built-in comparator will be used.
*
* @returns {Array} - The sorted array.
*
*
* @example
* ### Ordering a table with `ngRepeat`
*
* The example below demonstrates a simple {@link ngRepeat ngRepeat}, where the data is sorted by
* age in descending order (expression is set to `'-age'`). The `comparator` is not set, which means
* it defaults to the built-in comparator.
*
<example name="orderBy-static" module="orderByExample1">
 <file name="index.html">
   <div ng-controller="ExampleController">
     <table class="friends">
       <tr>
         <th>Name</th>
         <th>Phone Number</th>
         <th>Age</th>
       </tr>
       <tr ng-repeat="friend in friends | orderBy:'-age'">
         <td>{{friend.name}}</td>
         <td>{{friend.phone}}</td>
         <td>{{friend.age}}</td>
       </tr>
     </table>
   </div>
 </file>
 <file name="script.js">
   angular.module('orderByExample1', [])
     .controller('ExampleController', ['$scope', function($scope) {
       $scope.friends = [
         {name: 'John',   phone: '555-1212',  age: 10},
         {name: 'Mary',   phone: '555-9876',  age: 19},
         {name: 'Mike',   phone: '555-4321',  age: 21},
         {name: 'Adam',   phone: '555-5678',  age: 35},
         {name: 'Julie',  phone: '555-8765',  age: 29}
       ];
     }]);
 </file>
 <file name="style.css">
   .friends {
     border-collapse: collapse;
   }

   .friends th {
     border-bottom: 1px solid;
   }
   .friends td, .friends th {
     border-left: 1px solid;
     padding: 5px 10px;
   }
   .friends td:first-child, .friends th:first-child {
     border-left: none;
   }
 </file>
 <file name="protractor.js" type="protractor">
   // Element locators
   var names = element.all(by.repeater('friends').column('friend.name'));

   it('should sort friends by age in reverse order', function() {
     expect(names.get(0).getText()).toBe('Adam');
     expect(names.get(1).getText()).toBe('Julie');
     expect(names.get(2).getText()).toBe('Mike');
     expect(names.get(3).getText()).toBe('Mary');
     expect(names.get(4).getText()).toBe('John');
   });
 </file>
</example>
* <hr />
*
* @example
* ### Changing parameters dynamically
*
* All parameters can be changed dynamically. The next example shows how you can make the columns of
* a table sortable, by binding the `expression` and `reverse` parameters to scope properties.
*
<example name="orderBy-dynamic" module="orderByExample2">
 <file name="index.html">
   <div ng-controller="ExampleController">
     <pre>Sort by = {{propertyName}}; reverse = {{reverse}}</pre>
     <hr/>
     <button ng-click="propertyName = null; reverse = false">Set to unsorted</button>
     <hr/>
     <table class="friends">
       <tr>
         <th>
           <button ng-click="sortBy('name')">Name</button>
           <span class="sortorder" ng-show="propertyName === 'name'" ng-class="{reverse: reverse}"></span>
         </th>
         <th>
           <button ng-click="sortBy('phone')">Phone Number</button>
           <span class="sortorder" ng-show="propertyName === 'phone'" ng-class="{reverse: reverse}"></span>
         </th>
         <th>
           <button ng-click="sortBy('age')">Age</button>
           <span class="sortorder" ng-show="propertyName === 'age'" ng-class="{reverse: reverse}"></span>
         </th>
       </tr>
       <tr ng-repeat="friend in friends | orderBy:propertyName:reverse">
         <td>{{friend.name}}</td>
         <td>{{friend.phone}}</td>
         <td>{{friend.age}}</td>
       </tr>
     </table>
   </div>
 </file>
 <file name="script.js">
   angular.module('orderByExample2', [])
     .controller('ExampleController', ['$scope', function($scope) {
       var friends = [
         {name: 'John',   phone: '555-1212',  age: 10},
         {name: 'Mary',   phone: '555-9876',  age: 19},
         {name: 'Mike',   phone: '555-4321',  age: 21},
         {name: 'Adam',   phone: '555-5678',  age: 35},
         {name: 'Julie',  phone: '555-8765',  age: 29}
       ];

       $scope.propertyName = 'age';
       $scope.reverse = true;
       $scope.friends = friends;

       $scope.sortBy = function(propertyName) {
         $scope.reverse = ($scope.propertyName === propertyName) ? !$scope.reverse : false;
         $scope.propertyName = propertyName;
       };
     }]);
 </file>
 <file name="style.css">
   .friends {
     border-collapse: collapse;
   }

   .friends th {
     border-bottom: 1px solid;
   }
   .friends td, .friends th {
     border-left: 1px solid;
     padding: 5px 10px;
   }
   .friends td:first-child, .friends th:first-child {
     border-left: none;
   }

   .sortorder:after {
     content: '\25b2';   // BLACK UP-POINTING TRIANGLE
   }
   .sortorder.reverse:after {
     content: '\25bc';   // BLACK DOWN-POINTING TRIANGLE
   }
 </file>
 <file name="protractor.js" type="protractor">
   // Element locators
   var unsortButton = element(by.partialButtonText('unsorted'));
   var nameHeader = element(by.partialButtonText('Name'));
   var phoneHeader = element(by.partialButtonText('Phone'));
   var ageHeader = element(by.partialButtonText('Age'));
   var firstName = element(by.repeater('friends').column('friend.name').row(0));
   var lastName = element(by.repeater('friends').column('friend.name').row(4));

   it('should sort friends by some property, when clicking on the column header', function() {
     expect(firstName.getText()).toBe('Adam');
     expect(lastName.getText()).toBe('John');

     phoneHeader.click();
     expect(firstName.getText()).toBe('John');
     expect(lastName.getText()).toBe('Mary');

     nameHeader.click();
     expect(firstName.getText()).toBe('Adam');
     expect(lastName.getText()).toBe('Mike');

     ageHeader.click();
     expect(firstName.getText()).toBe('John');
     expect(lastName.getText()).toBe('Adam');
   });

   it('should sort friends in reverse order, when clicking on the same column', function() {
     expect(firstName.getText()).toBe('Adam');
     expect(lastName.getText()).toBe('John');

     ageHeader.click();
     expect(firstName.getText()).toBe('John');
     expect(lastName.getText()).toBe('Adam');

     ageHeader.click();
     expect(firstName.getText()).toBe('Adam');
     expect(lastName.getText()).toBe('John');
   });

   it('should restore the original order, when clicking "Set to unsorted"', function() {
     expect(firstName.getText()).toBe('Adam');
     expect(lastName.getText()).toBe('John');

     unsortButton.click();
     expect(firstName.getText()).toBe('John');
     expect(lastName.getText()).toBe('Julie');
   });
 </file>
</example>
* <hr />
*
* @example
* ### Using `orderBy` inside a controller
*
* It is also possible to call the `orderBy` filter manually, by injecting `orderByFilter`, and
* calling it with the desired parameters. (Alternatively, you could inject the `$filter` factory
* and retrieve the `orderBy` filter with `$filter('orderBy')`.)
*
<example name="orderBy-call-manually" module="orderByExample3">
 <file name="index.html">
   <div ng-controller="ExampleController">
     <pre>Sort by = {{propertyName}}; reverse = {{reverse}}</pre>
     <hr/>
     <button ng-click="sortBy(null)">Set to unsorted</button>
     <hr/>
     <table class="friends">
       <tr>
         <th>
           <button ng-click="sortBy('name')">Name</button>
           <span class="sortorder" ng-show="propertyName === 'name'" ng-class="{reverse: reverse}"></span>
         </th>
         <th>
           <button ng-click="sortBy('phone')">Phone Number</button>
           <span class="sortorder" ng-show="propertyName === 'phone'" ng-class="{reverse: reverse}"></span>
         </th>
         <th>
           <button ng-click="sortBy('age')">Age</button>
           <span class="sortorder" ng-show="propertyName === 'age'" ng-class="{reverse: reverse}"></span>
         </th>
       </tr>
       <tr ng-repeat="friend in friends">
         <td>{{friend.name}}</td>
         <td>{{friend.phone}}</td>
         <td>{{friend.age}}</td>
       </tr>
     </table>
   </div>
 </file>
 <file name="script.js">
   angular.module('orderByExample3', [])
     .controller('ExampleController', ['$scope', 'orderByFilter', function($scope, orderBy) {
       var friends = [
         {name: 'John',   phone: '555-1212',  age: 10},
         {name: 'Mary',   phone: '555-9876',  age: 19},
         {name: 'Mike',   phone: '555-4321',  age: 21},
         {name: 'Adam',   phone: '555-5678',  age: 35},
         {name: 'Julie',  phone: '555-8765',  age: 29}
       ];

       $scope.propertyName = 'age';
       $scope.reverse = true;
       $scope.friends = orderBy(friends, $scope.propertyName, $scope.reverse);

       $scope.sortBy = function(propertyName) {
         $scope.reverse = (propertyName !== null && $scope.propertyName === propertyName)
             ? !$scope.reverse : false;
         $scope.propertyName = propertyName;
         $scope.friends = orderBy(friends, $scope.propertyName, $scope.reverse);
       };
     }]);
 </file>
 <file name="style.css">
   .friends {
     border-collapse: collapse;
   }

   .friends th {
     border-bottom: 1px solid;
   }
   .friends td, .friends th {
     border-left: 1px solid;
     padding: 5px 10px;
   }
   .friends td:first-child, .friends th:first-child {
     border-left: none;
   }

   .sortorder:after {
     content: '\25b2';   // BLACK UP-POINTING TRIANGLE
   }
   .sortorder.reverse:after {
     content: '\25bc';   // BLACK DOWN-POINTING TRIANGLE
   }
 </file>
 <file name="protractor.js" type="protractor">
   // Element locators
   var unsortButton = element(by.partialButtonText('unsorted'));
   var nameHeader = element(by.partialButtonText('Name'));
   var phoneHeader = element(by.partialButtonText('Phone'));
   var ageHeader = element(by.partialButtonText('Age'));
   var firstName = element(by.repeater('friends').column('friend.name').row(0));
   var lastName = element(by.repeater('friends').column('friend.name').row(4));

   it('should sort friends by some property, when clicking on the column header', function() {
     expect(firstName.getText()).toBe('Adam');
     expect(lastName.getText()).toBe('John');

     phoneHeader.click();
     expect(firstName.getText()).toBe('John');
     expect(lastName.getText()).toBe('Mary');

     nameHeader.click();
     expect(firstName.getText()).toBe('Adam');
     expect(lastName.getText()).toBe('Mike');

     ageHeader.click();
     expect(firstName.getText()).toBe('John');
     expect(lastName.getText()).toBe('Adam');
   });

   it('should sort friends in reverse order, when clicking on the same column', function() {
     expect(firstName.getText()).toBe('Adam');
     expect(lastName.getText()).toBe('John');

     ageHeader.click();
     expect(firstName.getText()).toBe('John');
     expect(lastName.getText()).toBe('Adam');

     ageHeader.click();
     expect(firstName.getText()).toBe('Adam');
     expect(lastName.getText()).toBe('John');
   });

   it('should restore the original order, when clicking "Set to unsorted"', function() {
     expect(firstName.getText()).toBe('Adam');
     expect(lastName.getText()).toBe('John');

     unsortButton.click();
     expect(firstName.getText()).toBe('John');
     expect(lastName.getText()).toBe('Julie');
   });
 </file>
</example>
* <hr />
*
* @example
* ### Using a custom comparator
*
* If you have very specific requirements about the way items are sorted, you can pass your own
* comparator function. For example, you might need to compare some strings in a locale-sensitive
* way. (When specifying a custom comparator, you also need to pass a value for the `reverse`
* argument - passing `false` retains the default sorting order, i.e. ascending.)
*
<example name="orderBy-custom-comparator" module="orderByExample4">
 <file name="index.html">
   <div ng-controller="ExampleController">
     <div class="friends-container custom-comparator">
       <h3>Locale-sensitive Comparator</h3>
       <table class="friends">
         <tr>
           <th>Name</th>
           <th>Favorite Letter</th>
         </tr>
         <tr ng-repeat="friend in friends | orderBy:'favoriteLetter':false:localeSensitiveComparator">
           <td>{{friend.name}}</td>
           <td>{{friend.favoriteLetter}}</td>
         </tr>
       </table>
     </div>
     <div class="friends-container default-comparator">
       <h3>Default Comparator</h3>
       <table class="friends">
         <tr>
           <th>Name</th>
           <th>Favorite Letter</th>
         </tr>
         <tr ng-repeat="friend in friends | orderBy:'favoriteLetter'">
           <td>{{friend.name}}</td>
           <td>{{friend.favoriteLetter}}</td>
         </tr>
       </table>
     </div>
   </div>
 </file>
 <file name="script.js">
   angular.module('orderByExample4', [])
     .controller('ExampleController', ['$scope', function($scope) {
       $scope.friends = [
         {name: 'John',   favoriteLetter: 'Ã„'},
         {name: 'Mary',   favoriteLetter: 'Ãœ'},
         {name: 'Mike',   favoriteLetter: 'Ã–'},
         {name: 'Adam',   favoriteLetter: 'H'},
         {name: 'Julie',  favoriteLetter: 'Z'}
       ];

       $scope.localeSensitiveComparator = function(v1, v2) {
         // If we don't get strings, just compare by index
         if (v1.type !== 'string' || v2.type !== 'string') {
           return (v1.index < v2.index) ? -1 : 1;
         }

         // Compare strings alphabetically, taking locale into account
         return v1.value.localeCompare(v2.value);
       };
     }]);
 </file>
 <file name="style.css">
   .friends-container {
     display: inline-block;
     margin: 0 30px;
   }

   .friends {
     border-collapse: collapse;
   }

   .friends th {
     border-bottom: 1px solid;
   }
   .friends td, .friends th {
     border-left: 1px solid;
     padding: 5px 10px;
   }
   .friends td:first-child, .friends th:first-child {
     border-left: none;
   }
 </file>
 <file name="protractor.js" type="protractor">
   // Element locators
   var container = element(by.css('.custom-comparator'));
   var names = container.all(by.repeater('friends').column('friend.name'));

   it('should sort friends by favorite letter (in correct alphabetical order)', function() {
     expect(names.get(0).getText()).toBe('John');
     expect(names.get(1).getText()).toBe('Adam');
     expect(names.get(2).getText()).toBe('Mike');
     expect(names.get(3).getText()).toBe('Mary');
     expect(names.get(4).getText()).toBe('Julie');
   });
 </file>
</example>
*
*/
orderByFilter.$inject = ['$parse'];
function orderByFilter($parse) {
return function(array, sortPredicate, reverseOrder, compareFn) {

if (array == null) return array;
if (!isArrayLike(array)) {
  throw minErr('orderBy')('notarray', 'Expected array but received: {0}', array);
}

if (!isArray(sortPredicate)) { sortPredicate = [sortPredicate]; }
if (sortPredicate.length === 0) { sortPredicate = ['+']; }

var predicates = processPredicates(sortPredicate);

var descending = reverseOrder ? -1 : 1;

// Define the `compare()` function. Use a default comparator if none is specified.
var compare = isFunction(compareFn) ? compareFn : defaultCompare;

// The next three lines are a version of a Swartzian Transform idiom from Perl
// (sometimes called the Decorate-Sort-Undecorate idiom)
// See https://en.wikipedia.org/wiki/Schwartzian_transform
var compareValues = Array.prototype.map.call(array, getComparisonObject);
compareValues.sort(doComparison);
array = compareValues.map(function(item) { return item.value; });

return array;

function getComparisonObject(value, index) {
  // NOTE: We are adding an extra `tieBreaker` value based on the element's index.
  // This will be used to keep the sort stable when none of the input predicates can
  // distinguish between two elements.
  return {
    value: value,
    tieBreaker: {value: index, type: 'number', index: index},
    predicateValues: predicates.map(function(predicate) {
      return getPredicateValue(predicate.get(value), index);
    })
  };
}

function doComparison(v1, v2) {
  for (var i = 0, ii = predicates.length; i < ii; i++) {
    var result = compare(v1.predicateValues[i], v2.predicateValues[i]);
    if (result) {
      return result * predicates[i].descending * descending;
    }
  }

  return (compare(v1.tieBreaker, v2.tieBreaker) || defaultCompare(v1.tieBreaker, v2.tieBreaker)) * descending;
}
};

function processPredicates(sortPredicates) {
return sortPredicates.map(function(predicate) {
  var descending = 1, get = identity;

  if (isFunction(predicate)) {
    get = predicate;
  } else if (isString(predicate)) {
    if ((predicate.charAt(0) === '+' || predicate.charAt(0) === '-')) {
      descending = predicate.charAt(0) === '-' ? -1 : 1;
      predicate = predicate.substring(1);
    }
    if (predicate !== '') {
      get = $parse(predicate);
      if (get.constant) {
        var key = get();
        get = function(value) { return value[key]; };
      }
    }
  }
  return {get: get, descending: descending};
});
}

function isPrimitive(value) {
switch (typeof value) {
  case 'number': /* falls through */
  case 'boolean': /* falls through */
  case 'string':
    return true;
  default:
    return false;
}
}

function objectValue(value) {
// If `valueOf` is a valid function use that
if (isFunction(value.valueOf)) {
  value = value.valueOf();
  if (isPrimitive(value)) return value;
}
// If `toString` is a valid function and not the one from `Object.prototype` use that
if (hasCustomToString(value)) {
  value = value.toString();
  if (isPrimitive(value)) return value;
}

return value;
}

function getPredicateValue(value, index) {
var type = typeof value;
if (value === null) {
  type = 'string';
  value = 'null';
} else if (type === 'object') {
  value = objectValue(value);
}
return {value: value, type: type, index: index};
}

function defaultCompare(v1, v2) {
var result = 0;
var type1 = v1.type;
var type2 = v2.type;

if (type1 === type2) {
  var value1 = v1.value;
  var value2 = v2.value;

  if (type1 === 'string') {
    // Compare strings case-insensitively
    value1 = value1.toLowerCase();
    value2 = value2.toLowerCase();
  } else if (type1 === 'object') {
    // For basic objects, use the position of the object
    // in the collection instead of the value
    if (isObject(value1)) value1 = v1.index;
    if (isObject(value2)) value2 = v2.index;
  }

  if (value1 !== value2) {
    result = value1 < value2 ? -1 : 1;
  }
} else {
  result = type1 < type2 ? -1 : 1;
}

return result;
}
}

function ngDirective(directive) {
if (isFunction(directive)) {
directive = {
  link: directive
};
}
directive.restrict = directive.restrict || 'AC';
return valueFn(directive);
}

/**
* @ngdoc directive
* @name a
* @restrict E
*
* @description
* Modifies the default behavior of the html a tag so that the default action is prevented when
* the href attribute is empty.
*
* For dynamically creating `href` attributes for a tags, see the {@link ng.ngHref `ngHref`} directive.
*/
var htmlAnchorDirective = valueFn({
restrict: 'E',
compile: function(element, attr) {
if (!attr.href && !attr.xlinkHref) {
  return function(scope, element) {
    // If the linked element is not an anchor tag anymore, do nothing
    if (element[0].nodeName.toLowerCase() !== 'a') return;

    // SVGAElement does not use the href attribute, but rather the 'xlinkHref' attribute.
    var href = toString.call(element.prop('href')) === '[object SVGAnimatedString]' ?
               'xlink:href' : 'href';
    element.on('click', function(event) {
      // if we have no href url, then don't navigate anywhere.
      if (!element.attr(href)) {
        event.preventDefault();
      }
    });
  };
}
}
});

/**
* @ngdoc directive
* @name ngHref
* @restrict A
* @priority 99
*
* @description
* Using AngularJS markup like `{{hash}}` in an href attribute will
* make the link go to the wrong URL if the user clicks it before
* AngularJS has a chance to replace the `{{hash}}` markup with its
* value. Until AngularJS replaces the markup the link will be broken
* and will most likely return a 404 error. The `ngHref` directive
* solves this problem.
*
* The wrong way to write it:
* ```html
* <a href="http://www.gravatar.com/avatar/{{hash}}">link1</a>
* ```
*
* The correct way to write it:
* ```html
* <a ng-href="http://www.gravatar.com/avatar/{{hash}}">link1</a>
* ```
*
* @element A
* @param {template} ngHref any string which can contain `{{}}` markup.
*
* @example
* This example shows various combinations of `href`, `ng-href` and `ng-click` attributes
* in links and their different behaviors:
<example name="ng-href">
  <file name="index.html">
    <input ng-model="value" /><br />
    <a id="link-1" href ng-click="value = 1">link 1</a> (link, don't reload)<br />
    <a id="link-2" href="" ng-click="value = 2">link 2</a> (link, don't reload)<br />
    <a id="link-3" ng-href="/{{'123'}}">link 3</a> (link, reload!)<br />
    <a id="link-4" href="" name="xx" ng-click="value = 4">anchor</a> (link, don't reload)<br />
    <a id="link-5" name="xxx" ng-click="value = 5">anchor</a> (no link)<br />
    <a id="link-6" ng-href="{{value}}">link</a> (link, change location)
  </file>
  <file name="protractor.js" type="protractor">
    it('should execute ng-click but not reload when href without value', function() {
      element(by.id('link-1')).click();
      expect(element(by.model('value')).getAttribute('value')).toEqual('1');
      expect(element(by.id('link-1')).getAttribute('href')).toBe('');
    });

    it('should execute ng-click but not reload when href empty string', function() {
      element(by.id('link-2')).click();
      expect(element(by.model('value')).getAttribute('value')).toEqual('2');
      expect(element(by.id('link-2')).getAttribute('href')).toBe('');
    });

    it('should execute ng-click and change url when ng-href specified', function() {
      expect(element(by.id('link-3')).getAttribute('href')).toMatch(/\/123$/);

      element(by.id('link-3')).click();

      // At this point, we navigate away from an AngularJS page, so we need
      // to use browser.driver to get the base webdriver.

      browser.wait(function() {
        return browser.driver.getCurrentUrl().then(function(url) {
          return url.match(/\/123$/);
        });
      }, 5000, 'page should navigate to /123');
    });

    it('should execute ng-click but not reload when href empty string and name specified', function() {
      element(by.id('link-4')).click();
      expect(element(by.model('value')).getAttribute('value')).toEqual('4');
      expect(element(by.id('link-4')).getAttribute('href')).toBe('');
    });

    it('should execute ng-click but not reload when no href but name specified', function() {
      element(by.id('link-5')).click();
      expect(element(by.model('value')).getAttribute('value')).toEqual('5');
      expect(element(by.id('link-5')).getAttribute('href')).toBe(null);
    });

    it('should only change url when only ng-href', function() {
      element(by.model('value')).clear();
      element(by.model('value')).sendKeys('6');
      expect(element(by.id('link-6')).getAttribute('href')).toMatch(/\/6$/);

      element(by.id('link-6')).click();

      // At this point, we navigate away from an AngularJS page, so we need
      // to use browser.driver to get the base webdriver.
      browser.wait(function() {
        return browser.driver.getCurrentUrl().then(function(url) {
          return url.match(/\/6$/);
        });
      }, 5000, 'page should navigate to /6');
    });
  </file>
</example>
*/

/**
* @ngdoc directive
* @name ngSrc
* @restrict A
* @priority 99
*
* @description
* Using AngularJS markup like `{{hash}}` in a `src` attribute doesn't
* work right: The browser will fetch from the URL with the literal
* text `{{hash}}` until AngularJS replaces the expression inside
* `{{hash}}`. The `ngSrc` directive solves this problem.
*
* The buggy way to write it:
* ```html
* <img src="http://www.gravatar.com/avatar/{{hash}}" alt="Description"/>
* ```
*
* The correct way to write it:
* ```html
* <img ng-src="http://www.gravatar.com/avatar/{{hash}}" alt="Description" />
* ```
*
* @element IMG
* @param {template} ngSrc any string which can contain `{{}}` markup.
*/

/**
* @ngdoc directive
* @name ngSrcset
* @restrict A
* @priority 99
*
* @description
* Using AngularJS markup like `{{hash}}` in a `srcset` attribute doesn't
* work right: The browser will fetch from the URL with the literal
* text `{{hash}}` until AngularJS replaces the expression inside
* `{{hash}}`. The `ngSrcset` directive solves this problem.
*
* The buggy way to write it:
* ```html
* <img srcset="http://www.gravatar.com/avatar/{{hash}} 2x" alt="Description"/>
* ```
*
* The correct way to write it:
* ```html
* <img ng-srcset="http://www.gravatar.com/avatar/{{hash}} 2x" alt="Description" />
* ```
*
* @element IMG
* @param {template} ngSrcset any string which can contain `{{}}` markup.
*/

/**
* @ngdoc directive
* @name ngDisabled
* @restrict A
* @priority 100
*
* @description
*
* This directive sets the `disabled` attribute on the element (typically a form control,
* e.g. `input`, `button`, `select` etc.) if the
* {@link guide/expression expression} inside `ngDisabled` evaluates to truthy.
*
* A special directive is necessary because we cannot use interpolation inside the `disabled`
* attribute. See the {@link guide/interpolation interpolation guide} for more info.
*
* @example
<example name="ng-disabled">
  <file name="index.html">
    <label>Click me to toggle: <input type="checkbox" ng-model="checked"></label><br/>
    <button ng-model="button" ng-disabled="checked">Button</button>
  </file>
  <file name="protractor.js" type="protractor">
    it('should toggle button', function() {
      expect(element(by.css('button')).getAttribute('disabled')).toBeFalsy();
      element(by.model('checked')).click();
      expect(element(by.css('button')).getAttribute('disabled')).toBeTruthy();
    });
  </file>
</example>
*
* @element INPUT
* @param {expression} ngDisabled If the {@link guide/expression expression} is truthy,
*     then the `disabled` attribute will be set on the element
*/


/**
* @ngdoc directive
* @name ngChecked
* @restrict A
* @priority 100
*
* @description
* Sets the `checked` attribute on the element, if the expression inside `ngChecked` is truthy.
*
* Note that this directive should not be used together with {@link ngModel `ngModel`},
* as this can lead to unexpected behavior.
*
* A special directive is necessary because we cannot use interpolation inside the `checked`
* attribute. See the {@link guide/interpolation interpolation guide} for more info.
*
* @example
<example name="ng-checked">
  <file name="index.html">
    <label>Check me to check both: <input type="checkbox" ng-model="leader"></label><br/>
    <input id="checkFollower" type="checkbox" ng-checked="leader" aria-label="Follower input">
  </file>
  <file name="protractor.js" type="protractor">
    it('should check both checkBoxes', function() {
      expect(element(by.id('checkFollower')).getAttribute('checked')).toBeFalsy();
      element(by.model('leader')).click();
      expect(element(by.id('checkFollower')).getAttribute('checked')).toBeTruthy();
    });
  </file>
</example>
*
* @element INPUT
* @param {expression} ngChecked If the {@link guide/expression expression} is truthy,
*     then the `checked` attribute will be set on the element
*/


/**
* @ngdoc directive
* @name ngReadonly
* @restrict A
* @priority 100
*
* @description
*
* Sets the `readonly` attribute on the element, if the expression inside `ngReadonly` is truthy.
* Note that `readonly` applies only to `input` elements with specific types. [See the input docs on
* MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-readonly) for more information.
*
* A special directive is necessary because we cannot use interpolation inside the `readonly`
* attribute. See the {@link guide/interpolation interpolation guide} for more info.
*
* @example
<example name="ng-readonly">
  <file name="index.html">
    <label>Check me to make text readonly: <input type="checkbox" ng-model="checked"></label><br/>
    <input type="text" ng-readonly="checked" value="I'm AngularJS" aria-label="Readonly field" />
  </file>
  <file name="protractor.js" type="protractor">
    it('should toggle readonly attr', function() {
      expect(element(by.css('[type="text"]')).getAttribute('readonly')).toBeFalsy();
      element(by.model('checked')).click();
      expect(element(by.css('[type="text"]')).getAttribute('readonly')).toBeTruthy();
    });
  </file>
</example>
*
* @element INPUT
* @param {expression} ngReadonly If the {@link guide/expression expression} is truthy,
*     then special attribute "readonly" will be set on the element
*/


/**
* @ngdoc directive
* @name ngSelected
* @restrict A
* @priority 100
*
* @description
*
* Sets the `selected` attribute on the element, if the expression inside `ngSelected` is truthy.
*
* A special directive is necessary because we cannot use interpolation inside the `selected`
* attribute. See the {@link guide/interpolation interpolation guide} for more info.
*
* <div class="alert alert-warning">
*   **Note:** `ngSelected` does not interact with the `select` and `ngModel` directives, it only
*   sets the `selected` attribute on the element. If you are using `ngModel` on the select, you
*   should not use `ngSelected` on the options, as `ngModel` will set the select value and
*   selected options.
* </div>
*
* @example
<example name="ng-selected">
  <file name="index.html">
    <label>Check me to select: <input type="checkbox" ng-model="selected"></label><br/>
    <select aria-label="ngSelected demo">
      <option>Hello!</option>
      <option id="greet" ng-selected="selected">Greetings!</option>
    </select>
  </file>
  <file name="protractor.js" type="protractor">
    it('should select Greetings!', function() {
      expect(element(by.id('greet')).getAttribute('selected')).toBeFalsy();
      element(by.model('selected')).click();
      expect(element(by.id('greet')).getAttribute('selected')).toBeTruthy();
    });
  </file>
</example>
*
* @element OPTION
* @param {expression} ngSelected If the {@link guide/expression expression} is truthy,
*     then special attribute "selected" will be set on the element
*/

/**
* @ngdoc directive
* @name ngOpen
* @restrict A
* @priority 100
*
* @description
*
* Sets the `open` attribute on the element, if the expression inside `ngOpen` is truthy.
*
* A special directive is necessary because we cannot use interpolation inside the `open`
* attribute. See the {@link guide/interpolation interpolation guide} for more info.
*
* ## A note about browser compatibility
*
* Internet Explorer and Edge do not support the `details` element, it is
* recommended to use {@link ng.ngShow} and {@link ng.ngHide} instead.
*
* @example
 <example name="ng-open">
   <file name="index.html">
     <label>Toggle details: <input type="checkbox" ng-model="open"></label><br/>
     <details id="details" ng-open="open">
        <summary>List</summary>
        <ul>
          <li>Apple</li>
          <li>Orange</li>
          <li>Durian</li>
        </ul>
     </details>
   </file>
   <file name="protractor.js" type="protractor">
     it('should toggle open', function() {
       expect(element(by.id('details')).getAttribute('open')).toBeFalsy();
       element(by.model('open')).click();
       expect(element(by.id('details')).getAttribute('open')).toBeTruthy();
     });
   </file>
 </example>
*
* @element DETAILS
* @param {expression} ngOpen If the {@link guide/expression expression} is truthy,
*     then special attribute "open" will be set on the element
*/

var ngAttributeAliasDirectives = {};

// boolean attrs are evaluated
forEach(BOOLEAN_ATTR, function(propName, attrName) {
// binding to multiple is not supported
if (propName === 'multiple') return;

function defaultLinkFn(scope, element, attr) {
scope.$watch(attr[normalized], function ngBooleanAttrWatchAction(value) {
  attr.$set(attrName, !!value);
});
}

var normalized = directiveNormalize('ng-' + attrName);
var linkFn = defaultLinkFn;

if (propName === 'checked') {
linkFn = function(scope, element, attr) {
  // ensuring ngChecked doesn't interfere with ngModel when both are set on the same input
  if (attr.ngModel !== attr[normalized]) {
    defaultLinkFn(scope, element, attr);
  }
};
}

ngAttributeAliasDirectives[normalized] = function() {
return {
  restrict: 'A',
  priority: 100,
  link: linkFn
};
};
});

// aliased input attrs are evaluated
forEach(ALIASED_ATTR, function(htmlAttr, ngAttr) {
ngAttributeAliasDirectives[ngAttr] = function() {
return {
  priority: 100,
  link: function(scope, element, attr) {
    //special case ngPattern when a literal regular expression value
    //is used as the expression (this way we don't have to watch anything).
    if (ngAttr === 'ngPattern' && attr.ngPattern.charAt(0) === '/') {
      var match = attr.ngPattern.match(REGEX_STRING_REGEXP);
      if (match) {
        attr.$set('ngPattern', new RegExp(match[1], match[2]));
        return;
      }
    }

    scope.$watch(attr[ngAttr], function ngAttrAliasWatchAction(value) {
      attr.$set(ngAttr, value);
    });
  }
};
};
});

// ng-src, ng-srcset, ng-href are interpolated
forEach(['src', 'srcset', 'href'], function(attrName) {
var normalized = directiveNormalize('ng-' + attrName);
ngAttributeAliasDirectives[normalized] = function() {
return {
  priority: 99, // it needs to run after the attributes are interpolated
  link: function(scope, element, attr) {
    var propName = attrName,
        name = attrName;

    if (attrName === 'href' &&
        toString.call(element.prop('href')) === '[object SVGAnimatedString]') {
      name = 'xlinkHref';
      attr.$attr[name] = 'xlink:href';
      propName = null;
    }

    attr.$observe(normalized, function(value) {
      if (!value) {
        if (attrName === 'href') {
          attr.$set(name, null);
        }
        return;
      }

      attr.$set(name, value);

      // Support: IE 9-11 only
      // On IE, if "ng:src" directive declaration is used and "src" attribute doesn't exist
      // then calling element.setAttribute('src', 'foo') doesn't do anything, so we need
      // to set the property as well to achieve the desired effect.
      // We use attr[attrName] value since $set can sanitize the url.
      if (msie && propName) element.prop(propName, attr[name]);
    });
  }
};
};
});

/* global -nullFormCtrl, -PENDING_CLASS, -SUBMITTED_CLASS
*/
var nullFormCtrl = {
$addControl: noop,
$$renameControl: nullFormRenameControl,
$removeControl: noop,
$setValidity: noop,
$setDirty: noop,
$setPristine: noop,
$setSubmitted: noop
},
PENDING_CLASS = 'ng-pending',
SUBMITTED_CLASS = 'ng-submitted';

function nullFormRenameControl(control, name) {
control.$name = name;
}

/**
* @ngdoc type
* @name form.FormController
*
* @property {boolean} $pristine True if user has not interacted with the form yet.
* @property {boolean} $dirty True if user has already interacted with the form.
* @property {boolean} $valid True if all of the containing forms and controls are valid.
* @property {boolean} $invalid True if at least one containing control or form is invalid.
* @property {boolean} $submitted True if user has submitted the form even if its invalid.
*
* @property {Object} $pending An object hash, containing references to controls or forms with
*  pending validators, where:
*
*  - keys are validations tokens (error names).
*  - values are arrays of controls or forms that have a pending validator for the given error name.
*
* See {@link form.FormController#$error $error} for a list of built-in validation tokens.
*
* @property {Object} $error An object hash, containing references to controls or forms with failing
*  validators, where:
*
*  - keys are validation tokens (error names),
*  - values are arrays of controls or forms that have a failing validator for the given error name.
*
*  Built-in validation tokens:
*  - `email`
*  - `max`
*  - `maxlength`
*  - `min`
*  - `minlength`
*  - `number`
*  - `pattern`
*  - `required`
*  - `url`
*  - `date`
*  - `datetimelocal`
*  - `time`
*  - `week`
*  - `month`
*
* @description
* `FormController` keeps track of all its controls and nested forms as well as the state of them,
* such as being valid/invalid or dirty/pristine.
*
* Each {@link ng.directive:form form} directive creates an instance
* of `FormController`.
*
*/
//asks for $scope to fool the BC controller module
FormController.$inject = ['$element', '$attrs', '$scope', '$animate', '$interpolate'];
function FormController($element, $attrs, $scope, $animate, $interpolate) {
this.$$controls = [];

// init state
this.$error = {};
this.$$success = {};
this.$pending = undefined;
this.$name = $interpolate($attrs.name || $attrs.ngForm || '')($scope);
this.$dirty = false;
this.$pristine = true;
this.$valid = true;
this.$invalid = false;
this.$submitted = false;
this.$$parentForm = nullFormCtrl;

this.$$element = $element;
this.$$animate = $animate;

setupValidity(this);
}

FormController.prototype = {
/**
* @ngdoc method
* @name form.FormController#$rollbackViewValue
*
* @description
* Rollback all form controls pending updates to the `$modelValue`.
*
* Updates may be pending by a debounced event or because the input is waiting for a some future
* event defined in `ng-model-options`. This method is typically needed by the reset button of
* a form that uses `ng-model-options` to pend updates.
*/
$rollbackViewValue: function() {
forEach(this.$$controls, function(control) {
  control.$rollbackViewValue();
});
},

/**
* @ngdoc method
* @name form.FormController#$commitViewValue
*
* @description
* Commit all form controls pending updates to the `$modelValue`.
*
* Updates may be pending by a debounced event or because the input is waiting for a some future
* event defined in `ng-model-options`. This method is rarely needed as `NgModelController`
* usually handles calling this in response to input events.
*/
$commitViewValue: function() {
forEach(this.$$controls, function(control) {
  control.$commitViewValue();
});
},

/**
* @ngdoc method
* @name form.FormController#$addControl
* @param {object} control control object, either a {@link form.FormController} or an
* {@link ngModel.NgModelController}
*
* @description
* Register a control with the form. Input elements using ngModelController do this automatically
* when they are linked.
*
* Note that the current state of the control will not be reflected on the new parent form. This
* is not an issue with normal use, as freshly compiled and linked controls are in a `$pristine`
* state.
*
* However, if the method is used programmatically, for example by adding dynamically created controls,
* or controls that have been previously removed without destroying their corresponding DOM element,
* it's the developers responsibility to make sure the current state propagates to the parent form.
*
* For example, if an input control is added that is already `$dirty` and has `$error` properties,
* calling `$setDirty()` and `$validate()` afterwards will propagate the state to the parent form.
*/
$addControl: function(control) {
// Breaking change - before, inputs whose name was "hasOwnProperty" were quietly ignored
// and not added to the scope.  Now we throw an error.
assertNotHasOwnProperty(control.$name, 'input');
this.$$controls.push(control);

if (control.$name) {
  this[control.$name] = control;
}

control.$$parentForm = this;
},

// Private API: rename a form control
$$renameControl: function(control, newName) {
var oldName = control.$name;

if (this[oldName] === control) {
  delete this[oldName];
}
this[newName] = control;
control.$name = newName;
},

/**
* @ngdoc method
* @name form.FormController#$removeControl
* @param {object} control control object, either a {@link form.FormController} or an
* {@link ngModel.NgModelController}
*
* @description
* Deregister a control from the form.
*
* Input elements using ngModelController do this automatically when they are destroyed.
*
* Note that only the removed control's validation state (`$errors`etc.) will be removed from the
* form. `$dirty`, `$submitted` states will not be changed, because the expected behavior can be
* different from case to case. For example, removing the only `$dirty` control from a form may or
* may not mean that the form is still `$dirty`.
*/
$removeControl: function(control) {
if (control.$name && this[control.$name] === control) {
  delete this[control.$name];
}
forEach(this.$pending, function(value, name) {
  // eslint-disable-next-line no-invalid-this
  this.$setValidity(name, null, control);
}, this);
forEach(this.$error, function(value, name) {
  // eslint-disable-next-line no-invalid-this
  this.$setValidity(name, null, control);
}, this);
forEach(this.$$success, function(value, name) {
  // eslint-disable-next-line no-invalid-this
  this.$setValidity(name, null, control);
}, this);

arrayRemove(this.$$controls, control);
control.$$parentForm = nullFormCtrl;
},

/**
* @ngdoc method
* @name form.FormController#$setDirty
*
* @description
* Sets the form to a dirty state.
*
* This method can be called to add the 'ng-dirty' class and set the form to a dirty
* state (ng-dirty class). This method will also propagate to parent forms.
*/
$setDirty: function() {
this.$$animate.removeClass(this.$$element, PRISTINE_CLASS);
this.$$animate.addClass(this.$$element, DIRTY_CLASS);
this.$dirty = true;
this.$pristine = false;
this.$$parentForm.$setDirty();
},

/**
* @ngdoc method
* @name form.FormController#$setPristine
*
* @description
* Sets the form to its pristine state.
*
* This method sets the form's `$pristine` state to true, the `$dirty` state to false, removes
* the `ng-dirty` class and adds the `ng-pristine` class. Additionally, it sets the `$submitted`
* state to false.
*
* This method will also propagate to all the controls contained in this form.
*
* Setting a form back to a pristine state is often useful when we want to 'reuse' a form after
* saving or resetting it.
*/
$setPristine: function() {
this.$$animate.setClass(this.$$element, PRISTINE_CLASS, DIRTY_CLASS + ' ' + SUBMITTED_CLASS);
this.$dirty = false;
this.$pristine = true;
this.$submitted = false;
forEach(this.$$controls, function(control) {
  control.$setPristine();
});
},

/**
* @ngdoc method
* @name form.FormController#$setUntouched
*
* @description
* Sets the form to its untouched state.
*
* This method can be called to remove the 'ng-touched' class and set the form controls to their
* untouched state (ng-untouched class).
*
* Setting a form controls back to their untouched state is often useful when setting the form
* back to its pristine state.
*/
$setUntouched: function() {
forEach(this.$$controls, function(control) {
  control.$setUntouched();
});
},

/**
* @ngdoc method
* @name form.FormController#$setSubmitted
*
* @description
* Sets the form to its submitted state.
*/
$setSubmitted: function() {
this.$$animate.addClass(this.$$element, SUBMITTED_CLASS);
this.$submitted = true;
this.$$parentForm.$setSubmitted();
}
};

/**
* @ngdoc method
* @name form.FormController#$setValidity
*
* @description
* Change the validity state of the form, and notify the parent form (if any).
*
* Application developers will rarely need to call this method directly. It is used internally, by
* {@link ngModel.NgModelController#$setValidity NgModelController.$setValidity()}, to propagate a
* control's validity state to the parent `FormController`.
*
* @param {string} validationErrorKey Name of the validator. The `validationErrorKey` will be
*        assigned to either `$error[validationErrorKey]` or `$pending[validationErrorKey]` (for
*        unfulfilled `$asyncValidators`), so that it is available for data-binding. The
*        `validationErrorKey` should be in camelCase and will get converted into dash-case for
*        class name. Example: `myError` will result in `ng-valid-my-error` and
*        `ng-invalid-my-error` classes and can be bound to as `{{ someForm.$error.myError }}`.
* @param {boolean} isValid Whether the current state is valid (true), invalid (false), pending
*        (undefined),  or skipped (null). Pending is used for unfulfilled `$asyncValidators`.
*        Skipped is used by AngularJS when validators do not run because of parse errors and when
*        `$asyncValidators` do not run because any of the `$validators` failed.
* @param {NgModelController | FormController} controller - The controller whose validity state is
*        triggering the change.
*/
addSetValidityMethod({
clazz: FormController,
set: function(object, property, controller) {
var list = object[property];
if (!list) {
  object[property] = [controller];
} else {
  var index = list.indexOf(controller);
  if (index === -1) {
    list.push(controller);
  }
}
},
unset: function(object, property, controller) {
var list = object[property];
if (!list) {
  return;
}
arrayRemove(list, controller);
if (list.length === 0) {
  delete object[property];
}
}
});

/**
* @ngdoc directive
* @name ngForm
* @restrict EAC
*
* @description
* Nestable alias of {@link ng.directive:form `form`} directive. HTML
* does not allow nesting of form elements. It is useful to nest forms, for example if the validity of a
* sub-group of controls needs to be determined.
*
* Note: the purpose of `ngForm` is to group controls,
* but not to be a replacement for the `<form>` tag with all of its capabilities
* (e.g. posting to the server, ...).
*
* @param {string=} ngForm|name Name of the form. If specified, the form controller will be published into
*                       related scope, under this name.
*
*/

/**
* @ngdoc directive
* @name form
* @restrict E
*
* @description
* Directive that instantiates
* {@link form.FormController FormController}.
*
* If the `name` attribute is specified, the form controller is published onto the current scope under
* this name.
*
* ## Alias: {@link ng.directive:ngForm `ngForm`}
*
* In AngularJS, forms can be nested. This means that the outer form is valid when all of the child
* forms are valid as well. However, browsers do not allow nesting of `<form>` elements, so
* AngularJS provides the {@link ng.directive:ngForm `ngForm`} directive, which behaves identically to
* `form` but can be nested. Nested forms can be useful, for example, if the validity of a sub-group
* of controls needs to be determined.
*
* ## CSS classes
*  - `ng-valid` is set if the form is valid.
*  - `ng-invalid` is set if the form is invalid.
*  - `ng-pending` is set if the form is pending.
*  - `ng-pristine` is set if the form is pristine.
*  - `ng-dirty` is set if the form is dirty.
*  - `ng-submitted` is set if the form was submitted.
*
* Keep in mind that ngAnimate can detect each of these classes when added and removed.
*
*
* ## Submitting a form and preventing the default action
*
* Since the role of forms in client-side AngularJS applications is different than in classical
* roundtrip apps, it is desirable for the browser not to translate the form submission into a full
* page reload that sends the data to the server. Instead some javascript logic should be triggered
* to handle the form submission in an application-specific way.
*
* For this reason, AngularJS prevents the default action (form submission to the server) unless the
* `<form>` element has an `action` attribute specified.
*
* You can use one of the following two ways to specify what javascript method should be called when
* a form is submitted:
*
* - {@link ng.directive:ngSubmit ngSubmit} directive on the form element
* - {@link ng.directive:ngClick ngClick} directive on the first
*  button or input field of type submit (input[type=submit])
*
* To prevent double execution of the handler, use only one of the {@link ng.directive:ngSubmit ngSubmit}
* or {@link ng.directive:ngClick ngClick} directives.
* This is because of the following form submission rules in the HTML specification:
*
* - If a form has only one input field then hitting enter in this field triggers form submit
* (`ngSubmit`)
* - if a form has 2+ input fields and no buttons or input[type=submit] then hitting enter
* doesn't trigger submit
* - if a form has one or more input fields and one or more buttons or input[type=submit] then
* hitting enter in any of the input fields will trigger the click handler on the *first* button or
* input[type=submit] (`ngClick`) *and* a submit handler on the enclosing form (`ngSubmit`)
*
* Any pending `ngModelOptions` changes will take place immediately when an enclosing form is
* submitted. Note that `ngClick` events will occur before the model is updated. Use `ngSubmit`
* to have access to the updated model.
*
* @animations
* Animations in ngForm are triggered when any of the associated CSS classes are added and removed.
* These classes are: `.ng-pristine`, `.ng-dirty`, `.ng-invalid` and `.ng-valid` as well as any
* other validations that are performed within the form. Animations in ngForm are similar to how
* they work in ngClass and animations can be hooked into using CSS transitions, keyframes as well
* as JS animations.
*
* The following example shows a simple way to utilize CSS transitions to style a form element
* that has been rendered as invalid after it has been validated:
*
* <pre>
* //be sure to include ngAnimate as a module to hook into more
* //advanced animations
* .my-form {
*   transition:0.5s linear all;
*   background: white;
* }
* .my-form.ng-invalid {
*   background: red;
*   color:white;
* }
* </pre>
*
* @example
<example name="ng-form" deps="angular-animate.js" animations="true" fixBase="true" module="formExample">
  <file name="index.html">
   <script>
     angular.module('formExample', [])
       .controller('FormController', ['$scope', function($scope) {
         $scope.userType = 'guest';
       }]);
   </script>
   <style>
    .my-form {
      transition:all linear 0.5s;
      background: transparent;
    }
    .my-form.ng-invalid {
      background: red;
    }
   </style>
   <form name="myForm" ng-controller="FormController" class="my-form">
     userType: <input name="input" ng-model="userType" required>
     <span class="error" ng-show="myForm.input.$error.required">Required!</span><br>
     <code>userType = {{userType}}</code><br>
     <code>myForm.input.$valid = {{myForm.input.$valid}}</code><br>
     <code>myForm.input.$error = {{myForm.input.$error}}</code><br>
     <code>myForm.$valid = {{myForm.$valid}}</code><br>
     <code>myForm.$error.required = {{!!myForm.$error.required}}</code><br>
    </form>
  </file>
  <file name="protractor.js" type="protractor">
    it('should initialize to model', function() {
      var userType = element(by.binding('userType'));
      var valid = element(by.binding('myForm.input.$valid'));

      expect(userType.getText()).toContain('guest');
      expect(valid.getText()).toContain('true');
    });

    it('should be invalid if empty', function() {
      var userType = element(by.binding('userType'));
      var valid = element(by.binding('myForm.input.$valid'));
      var userInput = element(by.model('userType'));

      userInput.clear();
      userInput.sendKeys('');

      expect(userType.getText()).toEqual('userType =');
      expect(valid.getText()).toContain('false');
    });
  </file>
</example>
*
* @param {string=} name Name of the form. If specified, the form controller will be published into
*                       related scope, under this name.
*/
var formDirectiveFactory = function(isNgForm) {
return ['$timeout', '$parse', function($timeout, $parse) {
var formDirective = {
  name: 'form',
  restrict: isNgForm ? 'EAC' : 'E',
  require: ['form', '^^?form'], //first is the form's own ctrl, second is an optional parent form
  controller: FormController,
  compile: function ngFormCompile(formElement, attr) {
    // Setup initial state of the control
    formElement.addClass(PRISTINE_CLASS).addClass(VALID_CLASS);

    var nameAttr = attr.name ? 'name' : (isNgForm && attr.ngForm ? 'ngForm' : false);

    return {
      pre: function ngFormPreLink(scope, formElement, attr, ctrls) {
        var controller = ctrls[0];

        // if `action` attr is not present on the form, prevent the default action (submission)
        if (!('action' in attr)) {
          // we can't use jq events because if a form is destroyed during submission the default
          // action is not prevented. see #1238
          //
          // IE 9 is not affected because it doesn't fire a submit event and try to do a full
          // page reload if the form was destroyed by submission of the form via a click handler
          // on a button in the form. Looks like an IE9 specific bug.
          var handleFormSubmission = function(event) {
            scope.$apply(function() {
              controller.$commitViewValue();
              controller.$setSubmitted();
            });

            event.preventDefault();
          };

          formElement[0].addEventListener('submit', handleFormSubmission);

          // unregister the preventDefault listener so that we don't not leak memory but in a
          // way that will achieve the prevention of the default action.
          formElement.on('$destroy', function() {
            $timeout(function() {
              formElement[0].removeEventListener('submit', handleFormSubmission);
            }, 0, false);
          });
        }

        var parentFormCtrl = ctrls[1] || controller.$$parentForm;
        parentFormCtrl.$addControl(controller);

        var setter = nameAttr ? getSetter(controller.$name) : noop;

        if (nameAttr) {
          setter(scope, controller);
          attr.$observe(nameAttr, function(newValue) {
            if (controller.$name === newValue) return;
            setter(scope, undefined);
            controller.$$parentForm.$$renameControl(controller, newValue);
            setter = getSetter(controller.$name);
            setter(scope, controller);
          });
        }
        formElement.on('$destroy', function() {
          controller.$$parentForm.$removeControl(controller);
          setter(scope, undefined);
          extend(controller, nullFormCtrl); //stop propagating child destruction handlers upwards
        });
      }
    };
  }
};

return formDirective;

function getSetter(expression) {
  if (expression === '') {
    //create an assignable expression, so forms with an empty name can be renamed later
    return $parse('this[""]').assign;
  }
  return $parse(expression).assign || noop;
}
}];
};

var formDirective = formDirectiveFactory();
var ngFormDirective = formDirectiveFactory(true);



// helper methods
function setupValidity(instance) {
instance.$$classCache = {};
instance.$$classCache[INVALID_CLASS] = !(instance.$$classCache[VALID_CLASS] = instance.$$element.hasClass(VALID_CLASS));
}
function addSetValidityMethod(context) {
var clazz = context.clazz,
  set = context.set,
  unset = context.unset;

clazz.prototype.$setValidity = function(validationErrorKey, state, controller) {
if (isUndefined(state)) {
  createAndSet(this, '$pending', validationErrorKey, controller);
} else {
  unsetAndCleanup(this, '$pending', validationErrorKey, controller);
}
if (!isBoolean(state)) {
  unset(this.$error, validationErrorKey, controller);
  unset(this.$$success, validationErrorKey, controller);
} else {
  if (state) {
    unset(this.$error, validationErrorKey, controller);
    set(this.$$success, validationErrorKey, controller);
  } else {
    set(this.$error, validationErrorKey, controller);
    unset(this.$$success, validationErrorKey, controller);
  }
}
if (this.$pending) {
  cachedToggleClass(this, PENDING_CLASS, true);
  this.$valid = this.$invalid = undefined;
  toggleValidationCss(this, '', null);
} else {
  cachedToggleClass(this, PENDING_CLASS, false);
  this.$valid = isObjectEmpty(this.$error);
  this.$invalid = !this.$valid;
  toggleValidationCss(this, '', this.$valid);
}

// re-read the state as the set/unset methods could have
// combined state in this.$error[validationError] (used for forms),
// where setting/unsetting only increments/decrements the value,
// and does not replace it.
var combinedState;
if (this.$pending && this.$pending[validationErrorKey]) {
  combinedState = undefined;
} else if (this.$error[validationErrorKey]) {
  combinedState = false;
} else if (this.$$success[validationErrorKey]) {
  combinedState = true;
} else {
  combinedState = null;
}

toggleValidationCss(this, validationErrorKey, combinedState);
this.$$parentForm.$setValidity(validationErrorKey, combinedState, this);
};

function createAndSet(ctrl, name, value, controller) {
if (!ctrl[name]) {
  ctrl[name] = {};
}
set(ctrl[name], value, controller);
}

function unsetAndCleanup(ctrl, name, value, controller) {
if (ctrl[name]) {
  unset(ctrl[name], value, controller);
}
if (isObjectEmpty(ctrl[name])) {
  ctrl[name] = undefined;
}
}

function cachedToggleClass(ctrl, className, switchValue) {
if (switchValue && !ctrl.$$classCache[className]) {
  ctrl.$$animate.addClass(ctrl.$$element, className);
  ctrl.$$classCache[className] = true;
} else if (!switchValue && ctrl.$$classCache[className]) {
  ctrl.$$animate.removeClass(ctrl.$$element, className);
  ctrl.$$classCache[className] = false;
}
}

function toggleValidationCss(ctrl, validationErrorKey, isValid) {
validationErrorKey = validationErrorKey ? '-' + snake_case(validationErrorKey, '-') : '';

cachedToggleClass(ctrl, VALID_CLASS + validationErrorKey, isValid === true);
cachedToggleClass(ctrl, INVALID_CLASS + validationErrorKey, isValid === false);
}
}

function isObjectEmpty(obj) {
if (obj) {
for (var prop in obj) {
  if (obj.hasOwnProperty(prop)) {
    return false;
  }
}
}
return true;
}

/* global
VALID_CLASS: false,
INVALID_CLASS: false,
PRISTINE_CLASS: false,
DIRTY_CLASS: false,
ngModelMinErr: false
*/

// Regex code was initially obtained from SO prior to modification: https://stackoverflow.com/questions/3143070/javascript-regex-iso-datetime#answer-3143231
var ISO_DATE_REGEXP = /^\d{4,}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+(?:[+-][0-2]\d:[0-5]\d|Z)$/;
// See valid URLs in RFC3987 (http://tools.ietf.org/html/rfc3987)
// Note: We are being more lenient, because browsers are too.
//   1. Scheme
//   2. Slashes
//   3. Username
//   4. Password
//   5. Hostname
//   6. Port
//   7. Path
//   8. Query
//   9. Fragment
//                 1111111111111111 222   333333    44444        55555555555555555555555     666     77777777     8888888     999
var URL_REGEXP = /^[a-z][a-z\d.+-]*:\/*(?:[^:@]+(?::[^@]+)?@)?(?:[^\s:/?#]+|\[[a-f\d:]+])(?::\d+)?(?:\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i;
// eslint-disable-next-line max-len
var EMAIL_REGEXP = /^(?=.{1,254}$)(?=.{1,64}@)[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+(\.[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
var NUMBER_REGEXP = /^\s*(-|\+)?(\d+|(\d*(\.\d*)))([eE][+-]?\d+)?\s*$/;
var DATE_REGEXP = /^(\d{4,})-(\d{2})-(\d{2})$/;
var DATETIMELOCAL_REGEXP = /^(\d{4,})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(\.\d{1,3})?)?$/;
var WEEK_REGEXP = /^(\d{4,})-W(\d\d)$/;
var MONTH_REGEXP = /^(\d{4,})-(\d\d)$/;
var TIME_REGEXP = /^(\d\d):(\d\d)(?::(\d\d)(\.\d{1,3})?)?$/;

var PARTIAL_VALIDATION_EVENTS = 'keydown wheel mousedown';
var PARTIAL_VALIDATION_TYPES = createMap();
forEach('date,datetime-local,month,time,week'.split(','), function(type) {
PARTIAL_VALIDATION_TYPES[type] = true;
});

var inputType = {

/**
* @ngdoc input
* @name input[text]
*
* @description
* Standard HTML text input with AngularJS data binding, inherited by most of the `input` elements.
*
*
* @param {string} ngModel Assignable AngularJS expression to data-bind to.
* @param {string=} name Property name of the form under which the control is published.
* @param {string=} required Adds `required` validation error key if the value is not entered.
* @param {string=} ngRequired Adds `required` attribute and `required` validation constraint to
*    the element when the ngRequired expression evaluates to true. Use `ngRequired` instead of
*    `required` when you want to data-bind to the `required` attribute.
* @param {number=} ngMinlength Sets `minlength` validation error key if the value is shorter than
*    minlength.
* @param {number=} ngMaxlength Sets `maxlength` validation error key if the value is longer than
*    maxlength. Setting the attribute to a negative or non-numeric value, allows view values of
*    any length.
* @param {string=} pattern Similar to `ngPattern` except that the attribute value is the actual string
*    that contains the regular expression body that will be converted to a regular expression
*    as in the ngPattern directive.
* @param {string=} ngPattern Sets `pattern` validation error key if the ngModel {@link ngModel.NgModelController#$viewValue $viewValue}
*    does not match a RegExp found by evaluating the AngularJS expression given in the attribute value.
*    If the expression evaluates to a RegExp object, then this is used directly.
*    If the expression evaluates to a string, then it will be converted to a RegExp
*    after wrapping it in `^` and `$` characters. For instance, `"abc"` will be converted to
*    `new RegExp('^abc$')`.<br />
*    **Note:** Avoid using the `g` flag on the RegExp, as it will cause each successive search to
*    start at the index of the last search's match, thus not taking the whole input value into
*    account.
* @param {string=} ngChange AngularJS expression to be executed when input changes due to user
*    interaction with the input element.
* @param {boolean=} [ngTrim=true] If set to false AngularJS will not automatically trim the input.
*    This parameter is ignored for input[type=password] controls, which will never trim the
*    input.
*
* @example
  <example name="text-input-directive" module="textInputExample">
    <file name="index.html">
     <script>
       angular.module('textInputExample', [])
         .controller('ExampleController', ['$scope', function($scope) {
           $scope.example = {
             text: 'guest',
             word: /^\s*\w*\s*$/
           };
         }]);
     </script>
     <form name="myForm" ng-controller="ExampleController">
       <label>Single word:
         <input type="text" name="input" ng-model="example.text"
                ng-pattern="example.word" required ng-trim="false">
       </label>
       <div role="alert">
         <span class="error" ng-show="myForm.input.$error.required">
           Required!</span>
         <span class="error" ng-show="myForm.input.$error.pattern">
           Single word only!</span>
       </div>
       <code>text = {{example.text}}</code><br/>
       <code>myForm.input.$valid = {{myForm.input.$valid}}</code><br/>
       <code>myForm.input.$error = {{myForm.input.$error}}</code><br/>
       <code>myForm.$valid = {{myForm.$valid}}</code><br/>
       <code>myForm.$error.required = {{!!myForm.$error.required}}</code><br/>
      </form>
    </file>
    <file name="protractor.js" type="protractor">
      var text = element(by.binding('example.text'));
      var valid = element(by.binding('myForm.input.$valid'));
      var input = element(by.model('example.text'));

      it('should initialize to model', function() {
        expect(text.getText()).toContain('guest');
        expect(valid.getText()).toContain('true');
      });

      it('should be invalid if empty', function() {
        input.clear();
        input.sendKeys('');

        expect(text.getText()).toEqual('text =');
        expect(valid.getText()).toContain('false');
      });

      it('should be invalid if multi word', function() {
        input.clear();
        input.sendKeys('hello world');

        expect(valid.getText()).toContain('false');
      });
    </file>
  </example>
*/
'text': textInputType,

/**
 * @ngdoc input
 * @name input[date]
 *
 * @description
 * Input with date validation and transformation. In browsers that do not yet support
 * the HTML5 date input, a text element will be used. In that case, text must be entered in a valid ISO-8601
 * date format (yyyy-MM-dd), for example: `2009-01-06`. Since many
 * modern browsers do not yet support this input type, it is important to provide cues to users on the
 * expected input format via a placeholder or label.
 *
 * The model must always be a Date object, otherwise AngularJS will throw an error.
 * Invalid `Date` objects (dates whose `getTime()` is `NaN`) will be rendered as an empty string.
 *
 * The timezone to be used to read/write the `Date` instance in the model can be defined using
 * {@link ng.directive:ngModelOptions ngModelOptions}. By default, this is the timezone of the browser.
 *
 * @param {string} ngModel Assignable AngularJS expression to data-bind to.
 * @param {string=} name Property name of the form under which the control is published.
 * @param {string=} min Sets the `min` validation error key if the value entered is less than `min`. This must be a
 *   valid ISO date string (yyyy-MM-dd). You can also use interpolation inside this attribute
 *   (e.g. `min="{{minDate | date:'yyyy-MM-dd'}}"`). Note that `min` will also add native HTML5
 *   constraint validation.
 * @param {string=} max Sets the `max` validation error key if the value entered is greater than `max`. This must be
 *   a valid ISO date string (yyyy-MM-dd). You can also use interpolation inside this attribute
 *   (e.g. `max="{{maxDate | date:'yyyy-MM-dd'}}"`). Note that `max` will also add native HTML5
 *   constraint validation.
 * @param {(date|string)=} ngMin Sets the `min` validation constraint to the Date / ISO date string
 *   the `ngMin` expression evaluates to. Note that it does not set the `min` attribute.
 * @param {(date|string)=} ngMax Sets the `max` validation constraint to the Date / ISO date string
 *   the `ngMax` expression evaluates to. Note that it does not set the `max` attribute.
 * @param {string=} required Sets `required` validation error key if the value is not entered.
 * @param {string=} ngRequired Adds `required` attribute and `required` validation constraint to
 *    the element when the ngRequired expression evaluates to true. Use `ngRequired` instead of
 *    `required` when you want to data-bind to the `required` attribute.
 * @param {string=} ngChange AngularJS expression to be executed when input changes due to user
 *    interaction with the input element.
 *
 * @example
 <example name="date-input-directive" module="dateInputExample">
 <file name="index.html">
   <script>
      angular.module('dateInputExample', [])
        .controller('DateController', ['$scope', function($scope) {
          $scope.example = {
            value: new Date(2013, 9, 22)
          };
        }]);
   </script>
   <form name="myForm" ng-controller="DateController as dateCtrl">
      <label for="exampleInput">Pick a date in 2013:</label>
      <input type="date" id="exampleInput" name="input" ng-model="example.value"
          placeholder="yyyy-MM-dd" min="2013-01-01" max="2013-12-31" required />
      <div role="alert">
        <span class="error" ng-show="myForm.input.$error.required">
            Required!</span>
        <span class="error" ng-show="myForm.input.$error.date">
            Not a valid date!</span>
       </div>
       <tt>value = {{example.value | date: "yyyy-MM-dd"}}</tt><br/>
       <tt>myForm.input.$valid = {{myForm.input.$valid}}</tt><br/>
       <tt>myForm.input.$error = {{myForm.input.$error}}</tt><br/>
       <tt>myForm.$valid = {{myForm.$valid}}</tt><br/>
       <tt>myForm.$error.required = {{!!myForm.$error.required}}</tt><br/>
   </form>
 </file>
 <file name="protractor.js" type="protractor">
    var value = element(by.binding('example.value | date: "yyyy-MM-dd"'));
    var valid = element(by.binding('myForm.input.$valid'));

    // currently protractor/webdriver does not support
    // sending keys to all known HTML5 input controls
    // for various browsers (see https://github.com/angular/protractor/issues/562).
    function setInput(val) {
      // set the value of the element and force validation.
      var scr = "var ipt = document.getElementById('exampleInput'); " +
      "ipt.value = '" + val + "';" +
      "angular.element(ipt).scope().$apply(function(s) { s.myForm[ipt.name].$setViewValue('" + val + "'); });";
      browser.executeScript(scr);
    }

    it('should initialize to model', function() {
      expect(value.getText()).toContain('2013-10-22');
      expect(valid.getText()).toContain('myForm.input.$valid = true');
    });

    it('should be invalid if empty', function() {
      setInput('');
      expect(value.getText()).toEqual('value =');
      expect(valid.getText()).toContain('myForm.input.$valid = false');
    });

    it('should be invalid if over max', function() {
      setInput('2015-01-01');
      expect(value.getText()).toContain('');
      expect(valid.getText()).toContain('myForm.input.$valid = false');
    });
 </file>
 </example>
 */
'date': createDateInputType('date', DATE_REGEXP,
     createDateParser(DATE_REGEXP, ['yyyy', 'MM', 'dd']),
     'yyyy-MM-dd'),

/**
* @ngdoc input
* @name input[datetime-local]
*
* @description
* Input with datetime validation and transformation. In browsers that do not yet support
* the HTML5 date input, a text element will be used. In that case, the text must be entered in a valid ISO-8601
* local datetime format (yyyy-MM-ddTHH:mm:ss), for example: `2010-12-28T14:57:00`.
*
* The model must always be a Date object, otherwise AngularJS will throw an error.
* Invalid `Date` objects (dates whose `getTime()` is `NaN`) will be rendered as an empty string.
*
* The timezone to be used to read/write the `Date` instance in the model can be defined using
* {@link ng.directive:ngModelOptions ngModelOptions}. By default, this is the timezone of the browser.
*
* @param {string} ngModel Assignable AngularJS expression to data-bind to.
* @param {string=} name Property name of the form under which the control is published.
* @param {string=} min Sets the `min` validation error key if the value entered is less than `min`.
*   This must be a valid ISO datetime format (yyyy-MM-ddTHH:mm:ss). You can also use interpolation
*   inside this attribute (e.g. `min="{{minDatetimeLocal | date:'yyyy-MM-ddTHH:mm:ss'}}"`).
*   Note that `min` will also add native HTML5 constraint validation.
* @param {string=} max Sets the `max` validation error key if the value entered is greater than `max`.
*   This must be a valid ISO datetime format (yyyy-MM-ddTHH:mm:ss). You can also use interpolation
*   inside this attribute (e.g. `max="{{maxDatetimeLocal | date:'yyyy-MM-ddTHH:mm:ss'}}"`).
*   Note that `max` will also add native HTML5 constraint validation.
* @param {(date|string)=} ngMin Sets the `min` validation error key to the Date / ISO datetime string
*   the `ngMin` expression evaluates to. Note that it does not set the `min` attribute.
* @param {(date|string)=} ngMax Sets the `max` validation error key to the Date / ISO datetime string
*   the `ngMax` expression evaluates to. Note that it does not set the `max` attribute.
* @param {string=} required Sets `required` validation error key if the value is not entered.
* @param {string=} ngRequired Adds `required` attribute and `required` validation constraint to
*    the element when the ngRequired expression evaluates to true. Use `ngRequired` instead of
*    `required` when you want to data-bind to the `required` attribute.
* @param {string=} ngChange AngularJS expression to be executed when input changes due to user
*    interaction with the input element.
*
* @example
<example name="datetimelocal-input-directive" module="dateExample">
<file name="index.html">
  <script>
    angular.module('dateExample', [])
      .controller('DateController', ['$scope', function($scope) {
        $scope.example = {
          value: new Date(2010, 11, 28, 14, 57)
        };
      }]);
  </script>
  <form name="myForm" ng-controller="DateController as dateCtrl">
    <label for="exampleInput">Pick a date between in 2013:</label>
    <input type="datetime-local" id="exampleInput" name="input" ng-model="example.value"
        placeholder="yyyy-MM-ddTHH:mm:ss" min="2001-01-01T00:00:00" max="2013-12-31T00:00:00" required />
    <div role="alert">
      <span class="error" ng-show="myForm.input.$error.required">
          Required!</span>
      <span class="error" ng-show="myForm.input.$error.datetimelocal">
          Not a valid date!</span>
    </div>
    <tt>value = {{example.value | date: "yyyy-MM-ddTHH:mm:ss"}}</tt><br/>
    <tt>myForm.input.$valid = {{myForm.input.$valid}}</tt><br/>
    <tt>myForm.input.$error = {{myForm.input.$error}}</tt><br/>
    <tt>myForm.$valid = {{myForm.$valid}}</tt><br/>
    <tt>myForm.$error.required = {{!!myForm.$error.required}}</tt><br/>
  </form>
</file>
<file name="protractor.js" type="protractor">
  var value = element(by.binding('example.value | date: "yyyy-MM-ddTHH:mm:ss"'));
  var valid = element(by.binding('myForm.input.$valid'));

  // currently protractor/webdriver does not support
  // sending keys to all known HTML5 input controls
  // for various browsers (https://github.com/angular/protractor/issues/562).
  function setInput(val) {
    // set the value of the element and force validation.
    var scr = "var ipt = document.getElementById('exampleInput'); " +
    "ipt.value = '" + val + "';" +
    "angular.element(ipt).scope().$apply(function(s) { s.myForm[ipt.name].$setViewValue('" + val + "'); });";
    browser.executeScript(scr);
  }

  it('should initialize to model', function() {
    expect(value.getText()).toContain('2010-12-28T14:57:00');
    expect(valid.getText()).toContain('myForm.input.$valid = true');
  });

  it('should be invalid if empty', function() {
    setInput('');
    expect(value.getText()).toEqual('value =');
    expect(valid.getText()).toContain('myForm.input.$valid = false');
  });

  it('should be invalid if over max', function() {
    setInput('2015-01-01T23:59:00');
    expect(value.getText()).toContain('');
    expect(valid.getText()).toContain('myForm.input.$valid = false');
  });
</file>
</example>
*/
'datetime-local': createDateInputType('datetimelocal', DATETIMELOCAL_REGEXP,
  createDateParser(DATETIMELOCAL_REGEXP, ['yyyy', 'MM', 'dd', 'HH', 'mm', 'ss', 'sss']),
  'yyyy-MM-ddTHH:mm:ss.sss'),

/**
* @ngdoc input
* @name input[time]
*
* @description
* Input with time validation and transformation. In browsers that do not yet support
* the HTML5 time input, a text element will be used. In that case, the text must be entered in a valid ISO-8601
* local time format (HH:mm:ss), for example: `14:57:00`. Model must be a Date object. This binding will always output a
* Date object to the model of January 1, 1970, or local date `new Date(1970, 0, 1, HH, mm, ss)`.
*
* The model must always be a Date object, otherwise AngularJS will throw an error.
* Invalid `Date` objects (dates whose `getTime()` is `NaN`) will be rendered as an empty string.
*
* The timezone to be used to read/write the `Date` instance in the model can be defined using
* {@link ng.directive:ngModelOptions ngModelOptions}. By default, this is the timezone of the browser.
*
* @param {string} ngModel Assignable AngularJS expression to data-bind to.
* @param {string=} name Property name of the form under which the control is published.
* @param {string=} min Sets the `min` validation error key if the value entered is less than `min`.
*   This must be a valid ISO time format (HH:mm:ss). You can also use interpolation inside this
*   attribute (e.g. `min="{{minTime | date:'HH:mm:ss'}}"`). Note that `min` will also add
*   native HTML5 constraint validation.
* @param {string=} max Sets the `max` validation error key if the value entered is greater than `max`.
*   This must be a valid ISO time format (HH:mm:ss). You can also use interpolation inside this
*   attribute (e.g. `max="{{maxTime | date:'HH:mm:ss'}}"`). Note that `max` will also add
*   native HTML5 constraint validation.
* @param {(date|string)=} ngMin Sets the `min` validation constraint to the Date / ISO time string the
*   `ngMin` expression evaluates to. Note that it does not set the `min` attribute.
* @param {(date|string)=} ngMax Sets the `max` validation constraint to the Date / ISO time string the
*   `ngMax` expression evaluates to. Note that it does not set the `max` attribute.
* @param {string=} required Sets `required` validation error key if the value is not entered.
* @param {string=} ngRequired Adds `required` attribute and `required` validation constraint to
*    the element when the ngRequired expression evaluates to true. Use `ngRequired` instead of
*    `required` when you want to data-bind to the `required` attribute.
* @param {string=} ngChange AngularJS expression to be executed when input changes due to user
*    interaction with the input element.
*
* @example
<example name="time-input-directive" module="timeExample">
<file name="index.html">
 <script>
  angular.module('timeExample', [])
    .controller('DateController', ['$scope', function($scope) {
      $scope.example = {
        value: new Date(1970, 0, 1, 14, 57, 0)
      };
    }]);
 </script>
 <form name="myForm" ng-controller="DateController as dateCtrl">
    <label for="exampleInput">Pick a time between 8am and 5pm:</label>
    <input type="time" id="exampleInput" name="input" ng-model="example.value"
        placeholder="HH:mm:ss" min="08:00:00" max="17:00:00" required />
    <div role="alert">
      <span class="error" ng-show="myForm.input.$error.required">
          Required!</span>
      <span class="error" ng-show="myForm.input.$error.time">
          Not a valid date!</span>
    </div>
    <tt>value = {{example.value | date: "HH:mm:ss"}}</tt><br/>
    <tt>myForm.input.$valid = {{myForm.input.$valid}}</tt><br/>
    <tt>myForm.input.$error = {{myForm.input.$error}}</tt><br/>
    <tt>myForm.$valid = {{myForm.$valid}}</tt><br/>
    <tt>myForm.$error.required = {{!!myForm.$error.required}}</tt><br/>
 </form>
</file>
<file name="protractor.js" type="protractor">
  var value = element(by.binding('example.value | date: "HH:mm:ss"'));
  var valid = element(by.binding('myForm.input.$valid'));

  // currently protractor/webdriver does not support
  // sending keys to all known HTML5 input controls
  // for various browsers (https://github.com/angular/protractor/issues/562).
  function setInput(val) {
    // set the value of the element and force validation.
    var scr = "var ipt = document.getElementById('exampleInput'); " +
    "ipt.value = '" + val + "';" +
    "angular.element(ipt).scope().$apply(function(s) { s.myForm[ipt.name].$setViewValue('" + val + "'); });";
    browser.executeScript(scr);
  }

  it('should initialize to model', function() {
    expect(value.getText()).toContain('14:57:00');
    expect(valid.getText()).toContain('myForm.input.$valid = true');
  });

  it('should be invalid if empty', function() {
    setInput('');
    expect(value.getText()).toEqual('value =');
    expect(valid.getText()).toContain('myForm.input.$valid = false');
  });

  it('should be invalid if over max', function() {
    setInput('23:59:00');
    expect(value.getText()).toContain('');
    expect(valid.getText()).toContain('myForm.input.$valid = false');
  });
</file>
</example>
*/
'time': createDateInputType('time', TIME_REGEXP,
  createDateParser(TIME_REGEXP, ['HH', 'mm', 'ss', 'sss']),
 'HH:mm:ss.sss'),

/**
* @ngdoc input
* @name input[week]
*
* @description
* Input with week-of-the-year validation and transformation to Date. In browsers that do not yet support
* the HTML5 week input, a text element will be used. In that case, the text must be entered in a valid ISO-8601
* week format (yyyy-W##), for example: `2013-W02`.
*
* The model must always be a Date object, otherwise AngularJS will throw an error.
* Invalid `Date` objects (dates whose `getTime()` is `NaN`) will be rendered as an empty string.
*
* The timezone to be used to read/write the `Date` instance in the model can be defined using
* {@link ng.directive:ngModelOptions ngModelOptions}. By default, this is the timezone of the browser.
*
* @param {string} ngModel Assignable AngularJS expression to data-bind to.
* @param {string=} name Property name of the form under which the control is published.
* @param {string=} min Sets the `min` validation error key if the value entered is less than `min`.
*   This must be a valid ISO week format (yyyy-W##). You can also use interpolation inside this
*   attribute (e.g. `min="{{minWeek | date:'yyyy-Www'}}"`). Note that `min` will also add
*   native HTML5 constraint validation.
* @param {string=} max Sets the `max` validation error key if the value entered is greater than `max`.
*   This must be a valid ISO week format (yyyy-W##). You can also use interpolation inside this
*   attribute (e.g. `max="{{maxWeek | date:'yyyy-Www'}}"`). Note that `max` will also add
*   native HTML5 constraint validation.
* @param {(date|string)=} ngMin Sets the `min` validation constraint to the Date / ISO week string
*   the `ngMin` expression evaluates to. Note that it does not set the `min` attribute.
* @param {(date|string)=} ngMax Sets the `max` validation constraint to the Date / ISO week string
*   the `ngMax` expression evaluates to. Note that it does not set the `max` attribute.
* @param {string=} required Sets `required` validation error key if the value is not entered.
* @param {string=} ngRequired Adds `required` attribute and `required` validation constraint to
*    the element when the ngRequired expression evaluates to true. Use `ngRequired` instead of
*    `required` when you want to data-bind to the `required` attribute.
* @param {string=} ngChange AngularJS expression to be executed when input changes due to user
*    interaction with the input element.
*
* @example
<example name="week-input-directive" module="weekExample">
<file name="index.html">
  <script>
  angular.module('weekExample', [])
    .controller('DateController', ['$scope', function($scope) {
      $scope.example = {
        value: new Date(2013, 0, 3)
      };
    }]);
  </script>
  <form name="myForm" ng-controller="DateController as dateCtrl">
    <label>Pick a date between in 2013:
      <input id="exampleInput" type="week" name="input" ng-model="example.value"
             placeholder="YYYY-W##" min="2012-W32"
             max="2013-W52" required />
    </label>
    <div role="alert">
      <span class="error" ng-show="myForm.input.$error.required">
          Required!</span>
      <span class="error" ng-show="myForm.input.$error.week">
          Not a valid date!</span>
    </div>
    <tt>value = {{example.value | date: "yyyy-Www"}}</tt><br/>
    <tt>myForm.input.$valid = {{myForm.input.$valid}}</tt><br/>
    <tt>myForm.input.$error = {{myForm.input.$error}}</tt><br/>
    <tt>myForm.$valid = {{myForm.$valid}}</tt><br/>
    <tt>myForm.$error.required = {{!!myForm.$error.required}}</tt><br/>
  </form>
</file>
<file name="protractor.js" type="protractor">
  var value = element(by.binding('example.value | date: "yyyy-Www"'));
  var valid = element(by.binding('myForm.input.$valid'));

  // currently protractor/webdriver does not support
  // sending keys to all known HTML5 input controls
  // for various browsers (https://github.com/angular/protractor/issues/562).
  function setInput(val) {
    // set the value of the element and force validation.
    var scr = "var ipt = document.getElementById('exampleInput'); " +
    "ipt.value = '" + val + "';" +
    "angular.element(ipt).scope().$apply(function(s) { s.myForm[ipt.name].$setViewValue('" + val + "'); });";
    browser.executeScript(scr);
  }

  it('should initialize to model', function() {
    expect(value.getText()).toContain('2013-W01');
    expect(valid.getText()).toContain('myForm.input.$valid = true');
  });

  it('should be invalid if empty', function() {
    setInput('');
    expect(value.getText()).toEqual('value =');
    expect(valid.getText()).toContain('myForm.input.$valid = false');
  });

  it('should be invalid if over max', function() {
    setInput('2015-W01');
    expect(value.getText()).toContain('');
    expect(valid.getText()).toContain('myForm.input.$valid = false');
  });
</file>
</example>
*/
'week': createDateInputType('week', WEEK_REGEXP, weekParser, 'yyyy-Www'),

/**
* @ngdoc input
* @name input[month]
*
* @description
* Input with month validation and transformation. In browsers that do not yet support
* the HTML5 month input, a text element will be used. In that case, the text must be entered in a valid ISO-8601
* month format (yyyy-MM), for example: `2009-01`.
*
* The model must always be a Date object, otherwise AngularJS will throw an error.
* Invalid `Date` objects (dates whose `getTime()` is `NaN`) will be rendered as an empty string.
* If the model is not set to the first of the month, the next view to model update will set it
* to the first of the month.
*
* The timezone to be used to read/write the `Date` instance in the model can be defined using
* {@link ng.directive:ngModelOptions ngModelOptions}. By default, this is the timezone of the browser.
*
* @param {string} ngModel Assignable AngularJS expression to data-bind to.
* @param {string=} name Property name of the form under which the control is published.
* @param {string=} min Sets the `min` validation error key if the value entered is less than `min`.
*   This must be a valid ISO month format (yyyy-MM). You can also use interpolation inside this
*   attribute (e.g. `min="{{minMonth | date:'yyyy-MM'}}"`). Note that `min` will also add
*   native HTML5 constraint validation.
* @param {string=} max Sets the `max` validation error key if the value entered is greater than `max`.
*   This must be a valid ISO month format (yyyy-MM). You can also use interpolation inside this
*   attribute (e.g. `max="{{maxMonth | date:'yyyy-MM'}}"`). Note that `max` will also add
*   native HTML5 constraint validation.
* @param {(date|string)=} ngMin Sets the `min` validation constraint to the Date / ISO week string
*   the `ngMin` expression evaluates to. Note that it does not set the `min` attribute.
* @param {(date|string)=} ngMax Sets the `max` validation constraint to the Date / ISO week string
*   the `ngMax` expression evaluates to. Note that it does not set the `max` attribute.

* @param {string=} required Sets `required` validation error key if the value is not entered.
* @param {string=} ngRequired Adds `required` attribute and `required` validation constraint to
*    the element when the ngRequired expression evaluates to true. Use `ngRequired` instead of
*    `required` when you want to data-bind to the `required` attribute.
* @param {string=} ngChange AngularJS expression to be executed when input changes due to user
*    interaction with the input element.
*
* @example
<example name="month-input-directive" module="monthExample">
<file name="index.html">
 <script>
  angular.module('monthExample', [])
    .controller('DateController', ['$scope', function($scope) {
      $scope.example = {
        value: new Date(2013, 9, 1)
      };
    }]);
 </script>
 <form name="myForm" ng-controller="DateController as dateCtrl">
   <label for="exampleInput">Pick a month in 2013:</label>
   <input id="exampleInput" type="month" name="input" ng-model="example.value"
      placeholder="yyyy-MM" min="2013-01" max="2013-12" required />
   <div role="alert">
     <span class="error" ng-show="myForm.input.$error.required">
        Required!</span>
     <span class="error" ng-show="myForm.input.$error.month">
        Not a valid month!</span>
   </div>
   <tt>value = {{example.value | date: "yyyy-MM"}}</tt><br/>
   <tt>myForm.input.$valid = {{myForm.input.$valid}}</tt><br/>
   <tt>myForm.input.$error = {{myForm.input.$error}}</tt><br/>
   <tt>myForm.$valid = {{myForm.$valid}}</tt><br/>
   <tt>myForm.$error.required = {{!!myForm.$error.required}}</tt><br/>
 </form>
</file>
<file name="protractor.js" type="protractor">
  var value = element(by.binding('example.value | date: "yyyy-MM"'));
  var valid = element(by.binding('myForm.input.$valid'));

  // currently protractor/webdriver does not support
  // sending keys to all known HTML5 input controls
  // for various browsers (https://github.com/angular/protractor/issues/562).
  function setInput(val) {
    // set the value of the element and force validation.
    var scr = "var ipt = document.getElementById('exampleInput'); " +
    "ipt.value = '" + val + "';" +
    "angular.element(ipt).scope().$apply(function(s) { s.myForm[ipt.name].$setViewValue('" + val + "'); });";
    browser.executeScript(scr);
  }

  it('should initialize to model', function() {
    expect(value.getText()).toContain('2013-10');
    expect(valid.getText()).toContain('myForm.input.$valid = true');
  });

  it('should be invalid if empty', function() {
    setInput('');
    expect(value.getText()).toEqual('value =');
    expect(valid.getText()).toContain('myForm.input.$valid = false');
  });

  it('should be invalid if over max', function() {
    setInput('2015-01');
    expect(value.getText()).toContain('');
    expect(valid.getText()).toContain('myForm.input.$valid = false');
  });
</file>
</example>
*/
'month': createDateInputType('month', MONTH_REGEXP,
 createDateParser(MONTH_REGEXP, ['yyyy', 'MM']),
 'yyyy-MM'),

/**
* @ngdoc input
* @name input[number]
*
* @description
* Text input with number validation and transformation. Sets the `number` validation
* error if not a valid number.
*
* <div class="alert alert-warning">
* The model must always be of type `number` otherwise AngularJS will throw an error.
* Be aware that a string containing a number is not enough. See the {@link ngModel:numfmt}
* error docs for more information and an example of how to convert your model if necessary.
* </div>
*
* ## Issues with HTML5 constraint validation
*
* In browsers that follow the
* [HTML5 specification](https://html.spec.whatwg.org/multipage/forms.html#number-state-%28type=number%29),
* `input[number]` does not work as expected with {@link ngModelOptions `ngModelOptions.allowInvalid`}.
* If a non-number is entered in the input, the browser will report the value as an empty string,
* which means the view / model values in `ngModel` and subsequently the scope value
* will also be an empty string.
*
*
* @param {string} ngModel Assignable AngularJS expression to data-bind to.
* @param {string=} name Property name of the form under which the control is published.
* @param {string=} min Sets the `min` validation error key if the value entered is less than `min`.
*    Can be interpolated.
* @param {string=} max Sets the `max` validation error key if the value entered is greater than `max`.
*    Can be interpolated.
* @param {string=} ngMin Like `min`, sets the `min` validation error key if the value entered is less than `ngMin`,
*    but does not trigger HTML5 native validation. Takes an expression.
* @param {string=} ngMax Like `max`, sets the `max` validation error key if the value entered is greater than `ngMax`,
*    but does not trigger HTML5 native validation. Takes an expression.
* @param {string=} step Sets the `step` validation error key if the value entered does not fit the `step` constraint.
*    Can be interpolated.
* @param {string=} ngStep Like `step`, sets the `step` validation error key if the value entered does not fit the `ngStep` constraint,
*    but does not trigger HTML5 native validation. Takes an expression.
* @param {string=} required Sets `required` validation error key if the value is not entered.
* @param {string=} ngRequired Adds `required` attribute and `required` validation constraint to
*    the element when the ngRequired expression evaluates to true. Use `ngRequired` instead of
*    `required` when you want to data-bind to the `required` attribute.
* @param {number=} ngMinlength Sets `minlength` validation error key if the value is shorter than
*    minlength.
* @param {number=} ngMaxlength Sets `maxlength` validation error key if the value is longer than
*    maxlength. Setting the attribute to a negative or non-numeric value, allows view values of
*    any length.
* @param {string=} pattern Similar to `ngPattern` except that the attribute value is the actual string
*    that contains the regular expression body that will be converted to a regular expression
*    as in the ngPattern directive.
* @param {string=} ngPattern Sets `pattern` validation error key if the ngModel {@link ngModel.NgModelController#$viewValue $viewValue}
*    does not match a RegExp found by evaluating the AngularJS expression given in the attribute value.
*    If the expression evaluates to a RegExp object, then this is used directly.
*    If the expression evaluates to a string, then it will be converted to a RegExp
*    after wrapping it in `^` and `$` characters. For instance, `"abc"` will be converted to
*    `new RegExp('^abc$')`.<br />
*    **Note:** Avoid using the `g` flag on the RegExp, as it will cause each successive search to
*    start at the index of the last search's match, thus not taking the whole input value into
*    account.
* @param {string=} ngChange AngularJS expression to be executed when input changes due to user
*    interaction with the input element.
*
* @example
  <example name="number-input-directive" module="numberExample">
    <file name="index.html">
     <script>
       angular.module('numberExample', [])
         .controller('ExampleController', ['$scope', function($scope) {
           $scope.example = {
             value: 12
           };
         }]);
     </script>
     <form name="myForm" ng-controller="ExampleController">
       <label>Number:
         <input type="number" name="input" ng-model="example.value"
                min="0" max="99" required>
      </label>
       <div role="alert">
         <span class="error" ng-show="myForm.input.$error.required">
           Required!</span>
         <span class="error" ng-show="myForm.input.$error.number">
           Not valid number!</span>
       </div>
       <tt>value = {{example.value}}</tt><br/>
       <tt>myForm.input.$valid = {{myForm.input.$valid}}</tt><br/>
       <tt>myForm.input.$error = {{myForm.input.$error}}</tt><br/>
       <tt>myForm.$valid = {{myForm.$valid}}</tt><br/>
       <tt>myForm.$error.required = {{!!myForm.$error.required}}</tt><br/>
      </form>
    </file>
    <file name="protractor.js" type="protractor">
      var value = element(by.binding('example.value'));
      var valid = element(by.binding('myForm.input.$valid'));
      var input = element(by.model('example.value'));

      it('should initialize to model', function() {
        expect(value.getText()).toContain('12');
        expect(valid.getText()).toContain('true');
      });

      it('should be invalid if empty', function() {
        input.clear();
        input.sendKeys('');
        expect(value.getText()).toEqual('value =');
        expect(valid.getText()).toContain('false');
      });

      it('should be invalid if over max', function() {
        input.clear();
        input.sendKeys('123');
        expect(value.getText()).toEqual('value =');
        expect(valid.getText()).toContain('false');
      });
    </file>
  </example>
*/
'number': numberInputType,


/**
* @ngdoc input
* @name input[url]
*
* @description
* Text input with URL validation. Sets the `url` validation error key if the content is not a
* valid URL.
*
* <div class="alert alert-warning">
* **Note:** `input[url]` uses a regex to validate urls that is derived from the regex
* used in Chromium. If you need stricter validation, you can use `ng-pattern` or modify
* the built-in validators (see the {@link guide/forms Forms guide})
* </div>
*
* @param {string} ngModel Assignable AngularJS expression to data-bind to.
* @param {string=} name Property name of the form under which the control is published.
* @param {string=} required Sets `required` validation error key if the value is not entered.
* @param {string=} ngRequired Adds `required` attribute and `required` validation constraint to
*    the element when the ngRequired expression evaluates to true. Use `ngRequired` instead of
*    `required` when you want to data-bind to the `required` attribute.
* @param {number=} ngMinlength Sets `minlength` validation error key if the value is shorter than
*    minlength.
* @param {number=} ngMaxlength Sets `maxlength` validation error key if the value is longer than
*    maxlength. Setting the attribute to a negative or non-numeric value, allows view values of
*    any length.
* @param {string=} pattern Similar to `ngPattern` except that the attribute value is the actual string
*    that contains the regular expression body that will be converted to a regular expression
*    as in the ngPattern directive.
* @param {string=} ngPattern Sets `pattern` validation error key if the ngModel {@link ngModel.NgModelController#$viewValue $viewValue}
*    does not match a RegExp found by evaluating the AngularJS expression given in the attribute value.
*    If the expression evaluates to a RegExp object, then this is used directly.
*    If the expression evaluates to a string, then it will be converted to a RegExp
*    after wrapping it in `^` and `$` characters. For instance, `"abc"` will be converted to
*    `new RegExp('^abc$')`.<br />
*    **Note:** Avoid using the `g` flag on the RegExp, as it will cause each successive search to
*    start at the index of the last search's match, thus not taking the whole input value into
*    account.
* @param {string=} ngChange AngularJS expression to be executed when input changes due to user
*    interaction with the input element.
*
* @example
  <example name="url-input-directive" module="urlExample">
    <file name="index.html">
     <script>
       angular.module('urlExample', [])
         .controller('ExampleController', ['$scope', function($scope) {
           $scope.url = {
             text: 'http://google.com'
           };
         }]);
     </script>
     <form name="myForm" ng-controller="ExampleController">
       <label>URL:
         <input type="url" name="input" ng-model="url.text" required>
       <label>
       <div role="alert">
         <span class="error" ng-show="myForm.input.$error.required">
           Required!</span>
         <span class="error" ng-show="myForm.input.$error.url">
           Not valid url!</span>
       </div>
       <tt>text = {{url.text}}</tt><br/>
       <tt>myForm.input.$valid = {{myForm.input.$valid}}</tt><br/>
       <tt>myForm.input.$error = {{myForm.input.$error}}</tt><br/>
       <tt>myForm.$valid = {{myForm.$valid}}</tt><br/>
       <tt>myForm.$error.required = {{!!myForm.$error.required}}</tt><br/>
       <tt>myForm.$error.url = {{!!myForm.$error.url}}</tt><br/>
      </form>
    </file>
    <file name="protractor.js" type="protractor">
      var text = element(by.binding('url.text'));
      var valid = element(by.binding('myForm.input.$valid'));
      var input = element(by.model('url.text'));

      it('should initialize to model', function() {
        expect(text.getText()).toContain('http://google.com');
        expect(valid.getText()).toContain('true');
      });

      it('should be invalid if empty', function() {
        input.clear();
        input.sendKeys('');

        expect(text.getText()).toEqual('text =');
        expect(valid.getText()).toContain('false');
      });

      it('should be invalid if not url', function() {
        input.clear();
        input.sendKeys('box');

        expect(valid.getText()).toContain('false');
      });
    </file>
  </example>
*/
'url': urlInputType,


/**
* @ngdoc input
* @name input[email]
*
* @description
* Text input with email validation. Sets the `email` validation error key if not a valid email
* address.
*
* <div class="alert alert-warning">
* **Note:** `input[email]` uses a regex to validate email addresses that is derived from the regex
* used in Chromium. If you need stricter validation (e.g. requiring a top-level domain), you can
* use `ng-pattern` or modify the built-in validators (see the {@link guide/forms Forms guide})
* </div>
*
* @param {string} ngModel Assignable AngularJS expression to data-bind to.
* @param {string=} name Property name of the form under which the control is published.
* @param {string=} required Sets `required` validation error key if the value is not entered.
* @param {string=} ngRequired Adds `required` attribute and `required` validation constraint to
*    the element when the ngRequired expression evaluates to true. Use `ngRequired` instead of
*    `required` when you want to data-bind to the `required` attribute.
* @param {number=} ngMinlength Sets `minlength` validation error key if the value is shorter than
*    minlength.
* @param {number=} ngMaxlength Sets `maxlength` validation error key if the value is longer than
*    maxlength. Setting the attribute to a negative or non-numeric value, allows view values of
*    any length.
* @param {string=} pattern Similar to `ngPattern` except that the attribute value is the actual string
*    that contains the regular expression body that will be converted to a regular expression
*    as in the ngPattern directive.
* @param {string=} ngPattern Sets `pattern` validation error key if the ngModel {@link ngModel.NgModelController#$viewValue $viewValue}
*    does not match a RegExp found by evaluating the AngularJS expression given in the attribute value.
*    If the expression evaluates to a RegExp object, then this is used directly.
*    If the expression evaluates to a string, then it will be converted to a RegExp
*    after wrapping it in `^` and `$` characters. For instance, `"abc"` will be converted to
*    `new RegExp('^abc$')`.<br />
*    **Note:** Avoid using the `g` flag on the RegExp, as it will cause each successive search to
*    start at the index of the last search's match, thus not taking the whole input value into
*    account.
* @param {string=} ngChange AngularJS expression to be executed when input changes due to user
*    interaction with the input element.
*
* @example
  <example name="email-input-directive" module="emailExample">
    <file name="index.html">
     <script>
       angular.module('emailExample', [])
         .controller('ExampleController', ['$scope', function($scope) {
           $scope.email = {
             text: 'me@example.com'
           };
         }]);
     </script>
       <form name="myForm" ng-controller="ExampleController">
         <label>Email:
           <input type="email" name="input" ng-model="email.text" required>
         </label>
         <div role="alert">
           <span class="error" ng-show="myForm.input.$error.required">
             Required!</span>
           <span class="error" ng-show="myForm.input.$error.email">
             Not valid email!</span>
         </div>
         <tt>text = {{email.text}}</tt><br/>
         <tt>myForm.input.$valid = {{myForm.input.$valid}}</tt><br/>
         <tt>myForm.input.$error = {{myForm.input.$error}}</tt><br/>
         <tt>myForm.$valid = {{myForm.$valid}}</tt><br/>
         <tt>myForm.$error.required = {{!!myForm.$error.required}}</tt><br/>
         <tt>myForm.$error.email = {{!!myForm.$error.email}}</tt><br/>
       </form>
     </file>
    <file name="protractor.js" type="protractor">
      var text = element(by.binding('email.text'));
      var valid = element(by.binding('myForm.input.$valid'));
      var input = element(by.model('email.text'));

      it('should initialize to model', function() {
        expect(text.getText()).toContain('me@example.com');
        expect(valid.getText()).toContain('true');
      });

      it('should be invalid if empty', function() {
        input.clear();
        input.sendKeys('');
        expect(text.getText()).toEqual('text =');
        expect(valid.getText()).toContain('false');
      });

      it('should be invalid if not email', function() {
        input.clear();
        input.sendKeys('xxx');

        expect(valid.getText()).toContain('false');
      });
    </file>
  </example>
*/
'email': emailInputType,


/**
* @ngdoc input
* @name input[radio]
*
* @description
* HTML radio button.
*
* @param {string} ngModel Assignable AngularJS expression to data-bind to.
* @param {string} value The value to which the `ngModel` expression should be set when selected.
*    Note that `value` only supports `string` values, i.e. the scope model needs to be a string,
*    too. Use `ngValue` if you need complex models (`number`, `object`, ...).
* @param {string=} name Property name of the form under which the control is published.
* @param {string=} ngChange AngularJS expression to be executed when input changes due to user
*    interaction with the input element.
* @param {string} ngValue AngularJS expression to which `ngModel` will be be set when the radio
*    is selected. Should be used instead of the `value` attribute if you need
*    a non-string `ngModel` (`boolean`, `array`, ...).
*
* @example
  <example name="radio-input-directive" module="radioExample">
    <file name="index.html">
     <script>
       angular.module('radioExample', [])
         .controller('ExampleController', ['$scope', function($scope) {
           $scope.color = {
             name: 'blue'
           };
           $scope.specialValue = {
             "id": "12345",
             "value": "green"
           };
         }]);
     </script>
     <form name="myForm" ng-controller="ExampleController">
       <label>
         <input type="radio" ng-model="color.name" value="red">
         Red
       </label><br/>
       <label>
         <input type="radio" ng-model="color.name" ng-value="specialValue">
         Green
       </label><br/>
       <label>
         <input type="radio" ng-model="color.name" value="blue">
         Blue
       </label><br/>
       <tt>color = {{color.name | json}}</tt><br/>
      </form>
      Note that `ng-value="specialValue"` sets radio item's value to be the value of `$scope.specialValue`.
    </file>
    <file name="protractor.js" type="protractor">
      it('should change state', function() {
        var inputs = element.all(by.model('color.name'));
        var color = element(by.binding('color.name'));

        expect(color.getText()).toContain('blue');

        inputs.get(0).click();
        expect(color.getText()).toContain('red');

        inputs.get(1).click();
        expect(color.getText()).toContain('green');
      });
    </file>
  </example>
*/
'radio': radioInputType,

/**
* @ngdoc input
* @name input[range]
*
* @description
* Native range input with validation and transformation.
*
* The model for the range input must always be a `Number`.
*
* IE9 and other browsers that do not support the `range` type fall back
* to a text input without any default values for `min`, `max` and `step`. Model binding,
* validation and number parsing are nevertheless supported.
*
* Browsers that support range (latest Chrome, Safari, Firefox, Edge) treat `input[range]`
* in a way that never allows the input to hold an invalid value. That means:
* - any non-numerical value is set to `(max + min) / 2`.
* - any numerical value that is less than the current min val, or greater than the current max val
* is set to the min / max val respectively.
* - additionally, the current `step` is respected, so the nearest value that satisfies a step
* is used.
*
* See the [HTML Spec on input[type=range]](https://www.w3.org/TR/html5/forms.html#range-state-(type=range))
* for more info.
*
* This has the following consequences for AngularJS:
*
* Since the element value should always reflect the current model value, a range input
* will set the bound ngModel expression to the value that the browser has set for the
* input element. For example, in the following input `<input type="range" ng-model="model.value">`,
* if the application sets `model.value = null`, the browser will set the input to `'50'`.
* AngularJS will then set the model to `50`, to prevent input and model value being out of sync.
*
* That means the model for range will immediately be set to `50` after `ngModel` has been
* initialized. It also means a range input can never have the required error.
*
* This does not only affect changes to the model value, but also to the values of the `min`,
* `max`, and `step` attributes. When these change in a way that will cause the browser to modify
* the input value, AngularJS will also update the model value.
*
* Automatic value adjustment also means that a range input element can never have the `required`,
* `min`, or `max` errors.
*
* However, `step` is currently only fully implemented by Firefox. Other browsers have problems
* when the step value changes dynamically - they do not adjust the element value correctly, but
* instead may set the `stepMismatch` error. If that's the case, the AngularJS will set the `step`
* error on the input, and set the model to `undefined`.
*
* Note that `input[range]` is not compatible with`ngMax`, `ngMin`, and `ngStep`, because they do
* not set the `min` and `max` attributes, which means that the browser won't automatically adjust
* the input value based on their values, and will always assume min = 0, max = 100, and step = 1.
*
* @param {string}  ngModel Assignable AngularJS expression to data-bind to.
* @param {string=} name Property name of the form under which the control is published.
* @param {string=} min Sets the `min` validation to ensure that the value entered is greater
*                  than `min`. Can be interpolated.
* @param {string=} max Sets the `max` validation to ensure that the value entered is less than `max`.
*                  Can be interpolated.
* @param {string=} step Sets the `step` validation to ensure that the value entered matches the `step`
*                  Can be interpolated.
* @param {string=} ngChange AngularJS expression to be executed when the ngModel value changes due
*                  to user interaction with the input element.
* @param {expression=} ngChecked If the expression is truthy, then the `checked` attribute will be set on the
*                      element. **Note** : `ngChecked` should not be used alongside `ngModel`.
*                      Checkout {@link ng.directive:ngChecked ngChecked} for usage.
*
* @example
  <example name="range-input-directive" module="rangeExample">
    <file name="index.html">
      <script>
        angular.module('rangeExample', [])
          .controller('ExampleController', ['$scope', function($scope) {
            $scope.value = 75;
            $scope.min = 10;
            $scope.max = 90;
          }]);
      </script>
      <form name="myForm" ng-controller="ExampleController">

        Model as range: <input type="range" name="range" ng-model="value" min="{{min}}"  max="{{max}}">
        <hr>
        Model as number: <input type="number" ng-model="value"><br>
        Min: <input type="number" ng-model="min"><br>
        Max: <input type="number" ng-model="max"><br>
        value = <code>{{value}}</code><br/>
        myForm.range.$valid = <code>{{myForm.range.$valid}}</code><br/>
        myForm.range.$error = <code>{{myForm.range.$error}}</code>
      </form>
    </file>
  </example>

* ## Range Input with ngMin & ngMax attributes