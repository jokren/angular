var ngModelOptionsDirective = function() {
    NgModelOptionsController.$inject = ['$attrs', '$scope'];
    function NgModelOptionsController($attrs, $scope) {
      this.$$attrs = $attrs;
      this.$$scope = $scope;
    }
    NgModelOptionsController.prototype = {
      $onInit: function() {
        var parentOptions = this.parentCtrl ? this.parentCtrl.$options : defaultModelOptions;
        var modelOptionsDefinition = this.$$scope.$eval(this.$$attrs.ngModelOptions);
  
        this.$options = parentOptions.createChild(modelOptionsDefinition);
      }
    };
  
    return {
      restrict: 'A',
      // ngModelOptions needs to run before ngModel and input directives
      priority: 10,
      require: {parentCtrl: '?^^ngModelOptions'},
      bindToController: true,
      controller: NgModelOptionsController
    };
  };
  
  
  // shallow copy over values from `src` that are not already specified on `dst`
  function defaults(dst, src) {
    forEach(src, function(value, key) {
      if (!isDefined(dst[key])) {
        dst[key] = value;
      }
    });
  }
  
  /**
   * @ngdoc directive
   * @name ngNonBindable
   * @restrict AC
   * @priority 1000
   * @element ANY
   *
   * @description
   * The `ngNonBindable` directive tells AngularJS not to compile or bind the contents of the current
   * DOM element, including directives on the element itself that have a lower priority than
   * `ngNonBindable`. This is useful if the element contains what appears to be AngularJS directives
   * and bindings but which should be ignored by AngularJS. This could be the case if you have a site
   * that displays snippets of code, for instance.
   *
   * @example
   * In this example there are two locations where a simple interpolation binding (`{{}}`) is present,
   * but the one wrapped in `ngNonBindable` is left alone.
   *
    <example name="ng-non-bindable">
      <file name="index.html">
        <div>Normal: {{1 + 2}}</div>
        <div ng-non-bindable>Ignored: {{1 + 2}}</div>
      </file>
      <file name="protractor.js" type="protractor">
       it('should check ng-non-bindable', function() {
         expect(element(by.binding('1 + 2')).getText()).toContain('3');
         expect(element.all(by.css('div')).last().getText()).toMatch(/1 \+ 2/);
       });
      </file>
    </example>
   */
  var ngNonBindableDirective = ngDirective({ terminal: true, priority: 1000 });
  
  /* exported ngOptionsDirective */
  
  /* global jqLiteRemove */
  
  var ngOptionsMinErr = minErr('ngOptions');
  
  /**
   * @ngdoc directive
   * @name ngOptions
   * @restrict A
   *
   * @description
   *
   * The `ngOptions` attribute can be used to dynamically generate a list of `<option>`
   * elements for the `<select>` element using the array or object obtained by evaluating the
   * `ngOptions` comprehension expression.
   *
   * In many cases, {@link ng.directive:ngRepeat ngRepeat} can be used on `<option>` elements instead of
   * `ngOptions` to achieve a similar result. However, `ngOptions` provides some benefits:
   * - more flexibility in how the `<select>`'s model is assigned via the `select` **`as`** part of the
   * comprehension expression
   * - reduced memory consumption by not creating a new scope for each repeated instance
   * - increased render speed by creating the options in a documentFragment instead of individually
   *
   * When an item in the `<select>` menu is selected, the array element or object property
   * represented by the selected option will be bound to the model identified by the `ngModel`
   * directive.
   *
   * Optionally, a single hard-coded `<option>` element, with the value set to an empty string, can
   * be nested into the `<select>` element. This element will then represent the `null` or "not selected"
   * option. See example below for demonstration.
   *
   * ## Complex Models (objects or collections)
   *
   * By default, `ngModel` watches the model by reference, not value. This is important to know when
   * binding the select to a model that is an object or a collection.
   *
   * One issue occurs if you want to preselect an option. For example, if you set
   * the model to an object that is equal to an object in your collection, `ngOptions` won't be able to set the selection,
   * because the objects are not identical. So by default, you should always reference the item in your collection
   * for preselections, e.g.: `$scope.selected = $scope.collection[3]`.
   *
   * Another solution is to use a `track by` clause, because then `ngOptions` will track the identity
   * of the item not by reference, but by the result of the `track by` expression. For example, if your
   * collection items have an id property, you would `track by item.id`.
   *
   * A different issue with objects or collections is that ngModel won't detect if an object property or
   * a collection item changes. For that reason, `ngOptions` additionally watches the model using
   * `$watchCollection`, when the expression contains a `track by` clause or the the select has the `multiple` attribute.
   * This allows ngOptions to trigger a re-rendering of the options even if the actual object/collection
   * has not changed identity, but only a property on the object or an item in the collection changes.
   *
   * Note that `$watchCollection` does a shallow comparison of the properties of the object (or the items in the collection
   * if the model is an array). This means that changing a property deeper than the first level inside the
   * object/collection will not trigger a re-rendering.
   *
   * ## `select` **`as`**
   *
   * Using `select` **`as`** will bind the result of the `select` expression to the model, but
   * the value of the `<select>` and `<option>` html elements will be either the index (for array data sources)
   * or property name (for object data sources) of the value within the collection. If a **`track by`** expression
   * is used, the result of that expression will be set as the value of the `option` and `select` elements.
   *
   *
   * ### `select` **`as`** and **`track by`**
   *
   * <div class="alert alert-warning">
   * Be careful when using `select` **`as`** and **`track by`** in the same expression.
   * </div>
   *
   * Given this array of items on the $scope:
   *
   * ```js
   * $scope.items = [{
   *   id: 1,
   *   label: 'aLabel',
   *   subItem: { name: 'aSubItem' }
   * }, {
   *   id: 2,
   *   label: 'bLabel',
   *   subItem: { name: 'bSubItem' }
   * }];
   * ```
   *
   * This will work:
   *
   * ```html
   * <select ng-options="item as item.label for item in items track by item.id" ng-model="selected"></select>
   * ```
   * ```js
   * $scope.selected = $scope.items[0];
   * ```
   *
   * but this will not work:
   *
   * ```html
   * <select ng-options="item.subItem as item.label for item in items track by item.id" ng-model="selected"></select>
   * ```
   * ```js
   * $scope.selected = $scope.items[0].subItem;
   * ```
   *
   * In both examples, the **`track by`** expression is applied successfully to each `item` in the
   * `items` array. Because the selected option has been set programmatically in the controller, the
   * **`track by`** expression is also applied to the `ngModel` value. In the first example, the
   * `ngModel` value is `items[0]` and the **`track by`** expression evaluates to `items[0].id` with
   * no issue. In the second example, the `ngModel` value is `items[0].subItem` and the **`track by`**
   * expression evaluates to `items[0].subItem.id` (which is undefined). As a result, the model value
   * is not matched against any `<option>` and the `<select>` appears as having no selected value.
   *
   *
   * @param {string} ngModel Assignable AngularJS expression to data-bind to.
   * @param {comprehension_expression} ngOptions in one of the following forms:
   *
   *   * for array data sources:
   *     * `label` **`for`** `value` **`in`** `array`
   *     * `select` **`as`** `label` **`for`** `value` **`in`** `array`
   *     * `label` **`group by`** `group` **`for`** `value` **`in`** `array`
   *     * `label` **`disable when`** `disable` **`for`** `value` **`in`** `array`
   *     * `label` **`group by`** `group` **`for`** `value` **`in`** `array` **`track by`** `trackexpr`
   *     * `label` **`disable when`** `disable` **`for`** `value` **`in`** `array` **`track by`** `trackexpr`
   *     * `label` **`for`** `value` **`in`** `array` | orderBy:`orderexpr` **`track by`** `trackexpr`
   *        (for including a filter with `track by`)
   *   * for object data sources:
   *     * `label` **`for (`**`key` **`,`** `value`**`) in`** `object`
   *     * `select` **`as`** `label` **`for (`**`key` **`,`** `value`**`) in`** `object`
   *     * `label` **`group by`** `group` **`for (`**`key`**`,`** `value`**`) in`** `object`
   *     * `label` **`disable when`** `disable` **`for (`**`key`**`,`** `value`**`) in`** `object`
   *     * `select` **`as`** `label` **`group by`** `group`
   *         **`for` `(`**`key`**`,`** `value`**`) in`** `object`
   *     * `select` **`as`** `label` **`disable when`** `disable`
   *         **`for` `(`**`key`**`,`** `value`**`) in`** `object`
   *
   * Where:
   *
   *   * `array` / `object`: an expression which evaluates to an array / object to iterate over.
   *   * `value`: local variable which will refer to each item in the `array` or each property value
   *      of `object` during iteration.
   *   * `key`: local variable which will refer to a property name in `object` during iteration.
   *   * `label`: The result of this expression will be the label for `<option>` element. The
   *     `expression` will most likely refer to the `value` variable (e.g. `value.propertyName`).
   *   * `select`: The result of this expression will be bound to the model of the parent `<select>`
   *      element. If not specified, `select` expression will default to `value`.
   *   * `group`: The result of this expression will be used to group options using the `<optgroup>`
   *      DOM element.
   *   * `disable`: The result of this expression will be used to disable the rendered `<option>`
   *      element. Return `true` to disable.
   *   * `trackexpr`: Used when working with an array of objects. The result of this expression will be
   *      used to identify the objects in the array. The `trackexpr` will most likely refer to the
   *     `value` variable (e.g. `value.propertyName`). With this the selection is preserved
   *      even when the options are recreated (e.g. reloaded from the server).
   * @param {string=} name Property name of the form under which the control is published.
   * @param {string=} required The control is considered valid only if value is entered.
   * @param {string=} ngRequired Adds `required` attribute and `required` validation constraint to
   *    the element when the ngRequired expression evaluates to true. Use `ngRequired` instead of
   *    `required` when you want to data-bind to the `required` attribute.
   * @param {string=} ngAttrSize sets the size of the select element dynamically. Uses the
   * {@link guide/interpolation#-ngattr-for-binding-to-arbitrary-attributes ngAttr} directive.
   *
   * @example
      <example module="selectExample" name="select">
        <file name="index.html">
          <script>
          angular.module('selectExample', [])
            .controller('ExampleController', ['$scope', function($scope) {
              $scope.colors = [
                {name:'black', shade:'dark'},
                {name:'white', shade:'light', notAnOption: true},
                {name:'red', shade:'dark'},
                {name:'blue', shade:'dark', notAnOption: true},
                {name:'yellow', shade:'light', notAnOption: false}
              ];
              $scope.myColor = $scope.colors[2]; // red
            }]);
          </script>
          <div ng-controller="ExampleController">
            <ul>
              <li ng-repeat="color in colors">
                <label>Name: <input ng-model="color.name"></label>
                <label><input type="checkbox" ng-model="color.notAnOption"> Disabled?</label>
                <button ng-click="colors.splice($index, 1)" aria-label="Remove">X</button>
              </li>
              <li>
                <button ng-click="colors.push({})">add</button>
              </li>
            </ul>
            <hr/>
            <label>Color (null not allowed):
              <select ng-model="myColor" ng-options="color.name for color in colors"></select>
            </label><br/>
            <label>Color (null allowed):
            <span  class="nullable">
              <select ng-model="myColor" ng-options="color.name for color in colors">
                <option value="">-- choose color --</option>
              </select>
            </span></label><br/>
  
            <label>Color grouped by shade:
              <select ng-model="myColor" ng-options="color.name group by color.shade for color in colors">
              </select>
            </label><br/>
  
            <label>Color grouped by shade, with some disabled:
              <select ng-model="myColor"
                    ng-options="color.name group by color.shade disable when color.notAnOption for color in colors">
              </select>
            </label><br/>
  
  
  
            Select <button ng-click="myColor = { name:'not in list', shade: 'other' }">bogus</button>.
            <br/>
            <hr/>
            Currently selected: {{ {selected_color:myColor} }}
            <div style="border:solid 1px black; height:20px"
                 ng-style="{'background-color':myColor.name}">
            </div>
          </div>
        </file>
        <file name="protractor.js" type="protractor">
           it('should check ng-options', function() {
             expect(element(by.binding('{selected_color:myColor}')).getText()).toMatch('red');
             element.all(by.model('myColor')).first().click();
             element.all(by.css('select[ng-model="myColor"] option')).first().click();
             expect(element(by.binding('{selected_color:myColor}')).getText()).toMatch('black');
             element(by.css('.nullable select[ng-model="myColor"]')).click();
             element.all(by.css('.nullable select[ng-model="myColor"] option')).first().click();
             expect(element(by.binding('{selected_color:myColor}')).getText()).toMatch('null');
           });
        </file>
      </example>
   */
  
  /* eslint-disable max-len */
  //                     //00001111111111000000000002222222222000000000000000000000333333333300000000000000000000000004444444444400000000000005555555555555000000000666666666666600000007777777777777000000000000000888888888800000000000000000009999999999
  var NG_OPTIONS_REGEXP = /^\s*([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+group\s+by\s+([\s\S]+?))?(?:\s+disable\s+when\s+([\s\S]+?))?\s+for\s+(?:([$\w][$\w]*)|(?:\(\s*([$\w][$\w]*)\s*,\s*([$\w][$\w]*)\s*\)))\s+in\s+([\s\S]+?)(?:\s+track\s+by\s+([\s\S]+?))?$/;
                          // 1: value expression (valueFn)
                          // 2: label expression (displayFn)
                          // 3: group by expression (groupByFn)
                          // 4: disable when expression (disableWhenFn)
                          // 5: array item variable name
                          // 6: object item key variable name
                          // 7: object item value variable name
                          // 8: collection expression
                          // 9: track by expression
  /* eslint-enable */
  
  
  var ngOptionsDirective = ['$compile', '$document', '$parse', function($compile, $document, $parse) {
  
    function parseOptionsExpression(optionsExp, selectElement, scope) {
  
      var match = optionsExp.match(NG_OPTIONS_REGEXP);
      if (!(match)) {
        throw ngOptionsMinErr('iexp',
          'Expected expression in form of ' +
          '\'_select_ (as _label_)? for (_key_,)?_value_ in _collection_\'' +
          ' but got \'{0}\'. Element: {1}',
          optionsExp, startingTag(selectElement));
      }
  
      // Extract the parts from the ngOptions expression
  
      // The variable name for the value of the item in the collection
      var valueName = match[5] || match[7];
      // The variable name for the key of the item in the collection
      var keyName = match[6];
  
      // An expression that generates the viewValue for an option if there is a label expression
      var selectAs = / as /.test(match[0]) && match[1];
      // An expression that is used to track the id of each object in the options collection
      var trackBy = match[9];
      // An expression that generates the viewValue for an option if there is no label expression
      var valueFn = $parse(match[2] ? match[1] : valueName);
      var selectAsFn = selectAs && $parse(selectAs);
      var viewValueFn = selectAsFn || valueFn;
      var trackByFn = trackBy && $parse(trackBy);
  
      // Get the value by which we are going to track the option
      // if we have a trackFn then use that (passing scope and locals)
      // otherwise just hash the given viewValue
      var getTrackByValueFn = trackBy ?
                                function(value, locals) { return trackByFn(scope, locals); } :
                                function getHashOfValue(value) { return hashKey(value); };
      var getTrackByValue = function(value, key) {
        return getTrackByValueFn(value, getLocals(value, key));
      };
  
      var displayFn = $parse(match[2] || match[1]);
      var groupByFn = $parse(match[3] || '');
      var disableWhenFn = $parse(match[4] || '');
      var valuesFn = $parse(match[8]);
  
      var locals = {};
      var getLocals = keyName ? function(value, key) {
        locals[keyName] = key;
        locals[valueName] = value;
        return locals;
      } : function(value) {
        locals[valueName] = value;
        return locals;
      };
  
  
      function Option(selectValue, viewValue, label, group, disabled) {
        this.selectValue = selectValue;
        this.viewValue = viewValue;
        this.label = label;
        this.group = group;
        this.disabled = disabled;
      }
  
      function getOptionValuesKeys(optionValues) {
        var optionValuesKeys;
  
        if (!keyName && isArrayLike(optionValues)) {
          optionValuesKeys = optionValues;
        } else {
          // if object, extract keys, in enumeration order, unsorted
          optionValuesKeys = [];
          for (var itemKey in optionValues) {
            if (optionValues.hasOwnProperty(itemKey) && itemKey.charAt(0) !== '$') {
              optionValuesKeys.push(itemKey);
            }
          }
        }
        return optionValuesKeys;
      }
  
      return {
        trackBy: trackBy,
        getTrackByValue: getTrackByValue,
        getWatchables: $parse(valuesFn, function(optionValues) {
          // Create a collection of things that we would like to watch (watchedArray)
          // so that they can all be watched using a single $watchCollection
          // that only runs the handler once if anything changes
          var watchedArray = [];
          optionValues = optionValues || [];
  
          var optionValuesKeys = getOptionValuesKeys(optionValues);
          var optionValuesLength = optionValuesKeys.length;
          for (var index = 0; index < optionValuesLength; index++) {
            var key = (optionValues === optionValuesKeys) ? index : optionValuesKeys[index];
            var value = optionValues[key];
  
            var locals = getLocals(value, key);
            var selectValue = getTrackByValueFn(value, locals);
            watchedArray.push(selectValue);
  
            // Only need to watch the displayFn if there is a specific label expression
            if (match[2] || match[1]) {
              var label = displayFn(scope, locals);
              watchedArray.push(label);
            }
  
            // Only need to watch the disableWhenFn if there is a specific disable expression
            if (match[4]) {
              var disableWhen = disableWhenFn(scope, locals);
              watchedArray.push(disableWhen);
            }
          }
          return watchedArray;
        }),
  
        getOptions: function() {
  
          var optionItems = [];
          var selectValueMap = {};
  
          // The option values were already computed in the `getWatchables` fn,
          // which must have been called to trigger `getOptions`
          var optionValues = valuesFn(scope) || [];
          var optionValuesKeys = getOptionValuesKeys(optionValues);
          var optionValuesLength = optionValuesKeys.length;
  
          for (var index = 0; index < optionValuesLength; index++) {
            var key = (optionValues === optionValuesKeys) ? index : optionValuesKeys[index];
            var value = optionValues[key];
            var locals = getLocals(value, key);
            var viewValue = viewValueFn(scope, locals);
            var selectValue = getTrackByValueFn(viewValue, locals);
            var label = displayFn(scope, locals);
            var group = groupByFn(scope, locals);
            var disabled = disableWhenFn(scope, locals);
            var optionItem = new Option(selectValue, viewValue, label, group, disabled);
  
            optionItems.push(optionItem);
            selectValueMap[selectValue] = optionItem;
          }
  
          return {
            items: optionItems,
            selectValueMap: selectValueMap,
            getOptionFromViewValue: function(value) {
              return selectValueMap[getTrackByValue(value)];
            },
            getViewValueFromOption: function(option) {
              // If the viewValue could be an object that may be mutated by the application,
              // we need to make a copy and not return the reference to the value on the option.
              return trackBy ? copy(option.viewValue) : option.viewValue;
            }
          };
        }
      };
    }
  
  
    // Support: IE 9 only
    // We can't just jqLite('<option>') since jqLite is not smart enough
    // to create it in <select> and IE barfs otherwise.
    var optionTemplate = window.document.createElement('option'),
        optGroupTemplate = window.document.createElement('optgroup');
  
      function ngOptionsPostLink(scope, selectElement, attr, ctrls) {
  
        var selectCtrl = ctrls[0];
        var ngModelCtrl = ctrls[1];
        var multiple = attr.multiple;
  
        // The emptyOption allows the application developer to provide their own custom "empty"
        // option when the viewValue does not match any of the option values.
        for (var i = 0, children = selectElement.children(), ii = children.length; i < ii; i++) {
          if (children[i].value === '') {
            selectCtrl.hasEmptyOption = true;
            selectCtrl.emptyOption = children.eq(i);
            break;
          }
        }
  
        // The empty option will be compiled and rendered before we first generate the options
        selectElement.empty();
  
        var providedEmptyOption = !!selectCtrl.emptyOption;
  
        var unknownOption = jqLite(optionTemplate.cloneNode(false));
        unknownOption.val('?');
  
        var options;
        var ngOptions = parseOptionsExpression(attr.ngOptions, selectElement, scope);
        // This stores the newly created options before they are appended to the select.
        // Since the contents are removed from the fragment when it is appended,
        // we only need to create it once.
        var listFragment = $document[0].createDocumentFragment();
  
        // Overwrite the implementation. ngOptions doesn't use hashes
        selectCtrl.generateUnknownOptionValue = function(val) {
          return '?';
        };
  
        // Update the controller methods for multiple selectable options
        if (!multiple) {
  
          selectCtrl.writeValue = function writeNgOptionsValue(value) {
            // The options might not be defined yet when ngModel tries to render
            if (!options) return;
  
            var selectedOption = selectElement[0].options[selectElement[0].selectedIndex];
            var option = options.getOptionFromViewValue(value);
  
            // Make sure to remove the selected attribute from the previously selected option
            // Otherwise, screen readers might get confused
            if (selectedOption) selectedOption.removeAttribute('selected');
  
            if (option) {
              // Don't update the option when it is already selected.
              // For example, the browser will select the first option by default. In that case,
              // most properties are set automatically - except the `selected` attribute, which we
              // set always
  
              if (selectElement[0].value !== option.selectValue) {
                selectCtrl.removeUnknownOption();
  
                selectElement[0].value = option.selectValue;
                option.element.selected = true;
              }
  
              option.element.setAttribute('selected', 'selected');
            } else {
              selectCtrl.selectUnknownOrEmptyOption(value);
            }
          };
  
          selectCtrl.readValue = function readNgOptionsValue() {
  
            var selectedOption = options.selectValueMap[selectElement.val()];
  
            if (selectedOption && !selectedOption.disabled) {
              selectCtrl.unselectEmptyOption();
              selectCtrl.removeUnknownOption();
              return options.getViewValueFromOption(selectedOption);
            }
            return null;
          };
  
          // If we are using `track by` then we must watch the tracked value on the model
          // since ngModel only watches for object identity change
          // FIXME: When a user selects an option, this watch will fire needlessly
          if (ngOptions.trackBy) {
            scope.$watch(
              function() { return ngOptions.getTrackByValue(ngModelCtrl.$viewValue); },
              function() { ngModelCtrl.$render(); }
            );
          }
  
        } else {
  
          selectCtrl.writeValue = function writeNgOptionsMultiple(values) {
            // The options might not be defined yet when ngModel tries to render
            if (!options) return;
  
            // Only set `<option>.selected` if necessary, in order to prevent some browsers from
            // scrolling to `<option>` elements that are outside the `<select>` element's viewport.
            var selectedOptions = values && values.map(getAndUpdateSelectedOption) || [];
  
            options.items.forEach(function(option) {
              if (option.element.selected && !includes(selectedOptions, option)) {
                option.element.selected = false;
              }
            });
          };
  
  
          selectCtrl.readValue = function readNgOptionsMultiple() {
            var selectedValues = selectElement.val() || [],
                selections = [];
  
            forEach(selectedValues, function(value) {
              var option = options.selectValueMap[value];
              if (option && !option.disabled) selections.push(options.getViewValueFromOption(option));
            });
  
            return selections;
          };
  
          // If we are using `track by` then we must watch these tracked values on the model
          // since ngModel only watches for object identity change
          if (ngOptions.trackBy) {
  
            scope.$watchCollection(function() {
              if (isArray(ngModelCtrl.$viewValue)) {
                return ngModelCtrl.$viewValue.map(function(value) {
                  return ngOptions.getTrackByValue(value);
                });
              }
            }, function() {
              ngModelCtrl.$render();
            });
  
          }
        }
  
        if (providedEmptyOption) {
  
          // compile the element since there might be bindings in it
          $compile(selectCtrl.emptyOption)(scope);
  
          selectElement.prepend(selectCtrl.emptyOption);
  
          if (selectCtrl.emptyOption[0].nodeType === NODE_TYPE_COMMENT) {
            // This means the empty option has currently no actual DOM node, probably because
            // it has been modified by a transclusion directive.
            selectCtrl.hasEmptyOption = false;
  
            // Redefine the registerOption function, which will catch
            // options that are added by ngIf etc. (rendering of the node is async because of
            // lazy transclusion)
            selectCtrl.registerOption = function(optionScope, optionEl) {
              if (optionEl.val() === '') {
                selectCtrl.hasEmptyOption = true;
                selectCtrl.emptyOption = optionEl;
                selectCtrl.emptyOption.removeClass('ng-scope');
                // This ensures the new empty option is selected if previously no option was selected
                ngModelCtrl.$render();
  
                optionEl.on('$destroy', function() {
                  var needsRerender = selectCtrl.$isEmptyOptionSelected();
  
                  selectCtrl.hasEmptyOption = false;
                  selectCtrl.emptyOption = undefined;
  
                  if (needsRerender) ngModelCtrl.$render();
                });
              }
            };
  
          } else {
            // remove the class, which is added automatically because we recompile the element and it
            // becomes the compilation root
            selectCtrl.emptyOption.removeClass('ng-scope');
          }
  
        }
  
        // We will re-render the option elements if the option values or labels change
        scope.$watchCollection(ngOptions.getWatchables, updateOptions);
  
        // ------------------------------------------------------------------ //
  
        function addOptionElement(option, parent) {
          var optionElement = optionTemplate.cloneNode(false);
          parent.appendChild(optionElement);
          updateOptionElement(option, optionElement);
        }
  
        function getAndUpdateSelectedOption(viewValue) {
          var option = options.getOptionFromViewValue(viewValue);
          var element = option && option.element;
  
          if (element && !element.selected) element.selected = true;
  
          return option;
        }
  
        function updateOptionElement(option, element) {
          option.element = element;
          element.disabled = option.disabled;
          // Support: IE 11 only, Edge 12-13 only
          // NOTE: The label must be set before the value, otherwise IE 11 & Edge create unresponsive
          // selects in certain circumstances when multiple selects are next to each other and display
          // the option list in listbox style, i.e. the select is [multiple], or specifies a [size].
          // See https://github.com/angular/angular.js/issues/11314 for more info.
          // This is unfortunately untestable with unit / e2e tests
          if (option.label !== element.label) {
            element.label = option.label;
            element.textContent = option.label;
          }
          element.value = option.selectValue;
        }
  
        function updateOptions() {
          var previousValue = options && selectCtrl.readValue();
  
          // We must remove all current options, but cannot simply set innerHTML = null
          // since the providedEmptyOption might have an ngIf on it that inserts comments which we
          // must preserve.
          // Instead, iterate over the current option elements and remove them or their optgroup
          // parents
          if (options) {
  
            for (var i = options.items.length - 1; i >= 0; i--) {
              var option = options.items[i];
              if (isDefined(option.group)) {
                jqLiteRemove(option.element.parentNode);
              } else {
                jqLiteRemove(option.element);
              }
            }
          }
  
          options = ngOptions.getOptions();
  
          var groupElementMap = {};
  
          options.items.forEach(function addOption(option) {
            var groupElement;
  
            if (isDefined(option.group)) {
  
              // This option is to live in a group
              // See if we have already created this group
              groupElement = groupElementMap[option.group];
  
              if (!groupElement) {
  
                groupElement = optGroupTemplate.cloneNode(false);
                listFragment.appendChild(groupElement);
  
                // Update the label on the group element
                // "null" is special cased because of Safari
                groupElement.label = option.group === null ? 'null' : option.group;
  
                // Store it for use later
                groupElementMap[option.group] = groupElement;
              }
  
              addOptionElement(option, groupElement);
  
            } else {
  
              // This option is not in a group
              addOptionElement(option, listFragment);
            }
          });
  
          selectElement[0].appendChild(listFragment);
  
          ngModelCtrl.$render();
  
          // Check to see if the value has changed due to the update to the options
          if (!ngModelCtrl.$isEmpty(previousValue)) {
            var nextValue = selectCtrl.readValue();
            var isNotPrimitive = ngOptions.trackBy || multiple;
            if (isNotPrimitive ? !equals(previousValue, nextValue) : previousValue !== nextValue) {
              ngModelCtrl.$setViewValue(nextValue);
              ngModelCtrl.$render();
            }
          }
        }
    }
  
    return {
      restrict: 'A',
      terminal: true,
      require: ['select', 'ngModel'],
      link: {
        pre: function ngOptionsPreLink(scope, selectElement, attr, ctrls) {
          // Deactivate the SelectController.register method to prevent
          // option directives from accidentally registering themselves
          // (and unwanted $destroy handlers etc.)
          ctrls[0].registerOption = noop;
        },
        post: ngOptionsPostLink
      }
    };
  }];
  
  /**
   * @ngdoc directive
   * @name ngPluralize
   * @restrict EA
   *
   * @description
   * `ngPluralize` is a directive that displays messages according to en-US localization rules.
   * These rules are bundled with angular.js, but can be overridden
   * (see {@link guide/i18n AngularJS i18n} dev guide). You configure ngPluralize directive
   * by specifying the mappings between
   * [plural categories](http://unicode.org/repos/cldr-tmp/trunk/diff/supplemental/language_plural_rules.html)
   * and the strings to be displayed.
   *
   * ## Plural categories and explicit number rules
   * There are two
   * [plural categories](http://unicode.org/repos/cldr-tmp/trunk/diff/supplemental/language_plural_rules.html)
   * in AngularJS's default en-US locale: "one" and "other".
   *
   * While a plural category may match many numbers (for example, in en-US locale, "other" can match
   * any number that is not 1), an explicit number rule can only match one number. For example, the
   * explicit number rule for "3" matches the number 3. There are examples of plural categories
   * and explicit number rules throughout the rest of this documentation.
   *
   * ## Configuring ngPluralize
   * You configure ngPluralize by providing 2 attributes: `count` and `when`.
   * You can also provide an optional attribute, `offset`.
   *
   * The value of the `count` attribute can be either a string or an {@link guide/expression
   * AngularJS expression}; these are evaluated on the current scope for its bound value.
   *
   * The `when` attribute specifies the mappings between plural categories and the actual
   * string to be displayed. The value of the attribute should be a JSON object.
   *
   * The following example shows how to configure ngPluralize:
   *
   * ```html
   * <ng-pluralize count="personCount"
                   when="{'0': 'Nobody is viewing.',
   *                      'one': '1 person is viewing.',
   *                      'other': '{} people are viewing.'}">
   * </ng-pluralize>
   *```
   *
   * In the example, `"0: Nobody is viewing."` is an explicit number rule. If you did not
   * specify this rule, 0 would be matched to the "other" category and "0 people are viewing"
   * would be shown instead of "Nobody is viewing". You can specify an explicit number rule for
   * other numbers, for example 12, so that instead of showing "12 people are viewing", you can
   * show "a dozen people are viewing".
   *
   * You can use a set of closed braces (`{}`) as a placeholder for the number that you want substituted
   * into pluralized strings. In the previous example, AngularJS will replace `{}` with
   * <span ng-non-bindable>`{{personCount}}`</span>. The closed braces `{}` is a placeholder
   * for <span ng-non-bindable>{{numberExpression}}</span>.
   *
   * If no rule is defined for a category, then an empty string is displayed and a warning is generated.
   * Note that some locales define more categories than `one` and `other`. For example, fr-fr defines `few` and `many`.
   *
   * ## Configuring ngPluralize with offset
   * The `offset` attribute allows further customization of pluralized text, which can result in
   * a better user experience. For example, instead of the message "4 people are viewing this document",
   * you might display "John, Kate and 2 others are viewing this document".
   * The offset attribute allows you to offset a number by any desired value.
   * Let's take a look at an example:
   *
   * ```html
   * <ng-pluralize count="personCount" offset=2
   *               when="{'0': 'Nobody is viewing.',
   *                      '1': '{{person1}} is viewing.',
   *                      '2': '{{person1}} and {{person2}} are viewing.',
   *                      'one': '{{person1}}, {{person2}} and one other person are viewing.',
   *                      'other': '{{person1}}, {{person2}} and {} other people are viewing.'}">
   * </ng-pluralize>
   * ```
   *
   * Notice that we are still using two plural categories(one, other), but we added
   * three explicit number rules 0, 1 and 2.
   * When one person, perhaps John, views the document, "John is viewing" will be shown.
   * When three people view the document, no explicit number rule is found, so
   * an offset of 2 is taken off 3, and AngularJS uses 1 to decide the plural category.
   * In this case, plural category 'one' is matched and "John, Mary and one other person are viewing"
   * is shown.
   *
   * Note that when you specify offsets, you must provide explicit number rules for
   * numbers from 0 up to and including the offset. If you use an offset of 3, for example,
   * you must provide explicit number rules for 0, 1, 2 and 3. You must also provide plural strings for
   * plural categories "one" and "other".
   *
   * @param {string|expression} count The variable to be bound to.
   * @param {string} when The mapping between plural category to its corresponding strings.
   * @param {number=} offset Offset to deduct from the total number.
   *
   * @example
      <example module="pluralizeExample" name="ng-pluralize">
        <file name="index.html">
          <script>
            angular.module('pluralizeExample', [])
              .controller('ExampleController', ['$scope', function($scope) {
                $scope.person1 = 'Igor';
                $scope.person2 = 'Misko';
                $scope.personCount = 1;
              }]);
          </script>
          <div ng-controller="ExampleController">
            <label>Person 1:<input type="text" ng-model="person1" value="Igor" /></label><br/>
            <label>Person 2:<input type="text" ng-model="person2" value="Misko" /></label><br/>
            <label>Number of People:<input type="text" ng-model="personCount" value="1" /></label><br/>
  
            <!--- Example with simple pluralization rules for en locale --->
            Without Offset:
            <ng-pluralize count="personCount"
                          when="{'0': 'Nobody is viewing.',
                                 'one': '1 person is viewing.',
                                 'other': '{} people are viewing.'}">
            </ng-pluralize><br>
  
            <!--- Example with offset --->
            With Offset(2):
            <ng-pluralize count="personCount" offset=2
                          when="{'0': 'Nobody is viewing.',
                                 '1': '{{person1}} is viewing.',
                                 '2': '{{person1}} and {{person2}} are viewing.',
                                 'one': '{{person1}}, {{person2}} and one other person are viewing.',
                                 'other': '{{person1}}, {{person2}} and {} other people are viewing.'}">
            </ng-pluralize>
          </div>
        </file>
        <file name="protractor.js" type="protractor">
          it('should show correct pluralized string', function() {
            var withoutOffset = element.all(by.css('ng-pluralize')).get(0);
            var withOffset = element.all(by.css('ng-pluralize')).get(1);
            var countInput = element(by.model('personCount'));
  
            expect(withoutOffset.getText()).toEqual('1 person is viewing.');
            expect(withOffset.getText()).toEqual('Igor is viewing.');
  
            countInput.clear();
            countInput.sendKeys('0');
  
            expect(withoutOffset.getText()).toEqual('Nobody is viewing.');
            expect(withOffset.getText()).toEqual('Nobody is viewing.');
  
            countInput.clear();
            countInput.sendKeys('2');
  
            expect(withoutOffset.getText()).toEqual('2 people are viewing.');
            expect(withOffset.getText()).toEqual('Igor and Misko are viewing.');
  
            countInput.clear();
            countInput.sendKeys('3');
  
            expect(withoutOffset.getText()).toEqual('3 people are viewing.');
            expect(withOffset.getText()).toEqual('Igor, Misko and one other person are viewing.');
  
            countInput.clear();
            countInput.sendKeys('4');
  
            expect(withoutOffset.getText()).toEqual('4 people are viewing.');
            expect(withOffset.getText()).toEqual('Igor, Misko and 2 other people are viewing.');
          });
          it('should show data-bound names', function() {
            var withOffset = element.all(by.css('ng-pluralize')).get(1);
            var personCount = element(by.model('personCount'));
            var person1 = element(by.model('person1'));
            var person2 = element(by.model('person2'));
            personCount.clear();
            personCount.sendKeys('4');
            person1.clear();
            person1.sendKeys('Di');
            person2.clear();
            person2.sendKeys('Vojta');
            expect(withOffset.getText()).toEqual('Di, Vojta and 2 other people are viewing.');
          });
        </file>
      </example>
   */
  var ngPluralizeDirective = ['$locale', '$interpolate', '$log', function($locale, $interpolate, $log) {
    var BRACE = /{}/g,
        IS_WHEN = /^when(Minus)?(.+)$/;
  
    return {
      link: function(scope, element, attr) {
        var numberExp = attr.count,
            whenExp = attr.$attr.when && element.attr(attr.$attr.when), // we have {{}} in attrs
            offset = attr.offset || 0,
            whens = scope.$eval(whenExp) || {},
            whensExpFns = {},
            startSymbol = $interpolate.startSymbol(),
            endSymbol = $interpolate.endSymbol(),
            braceReplacement = startSymbol + numberExp + '-' + offset + endSymbol,
            watchRemover = angular.noop,
            lastCount;
  
        forEach(attr, function(expression, attributeName) {
          var tmpMatch = IS_WHEN.exec(attributeName);
          if (tmpMatch) {
            var whenKey = (tmpMatch[1] ? '-' : '') + lowercase(tmpMatch[2]);
            whens[whenKey] = element.attr(attr.$attr[attributeName]);
          }
        });
        forEach(whens, function(expression, key) {
          whensExpFns[key] = $interpolate(expression.replace(BRACE, braceReplacement));
  
        });
  
        scope.$watch(numberExp, function ngPluralizeWatchAction(newVal) {
          var count = parseFloat(newVal);
          var countIsNaN = isNumberNaN(count);
  
          if (!countIsNaN && !(count in whens)) {
            // If an explicit number rule such as 1, 2, 3... is defined, just use it.
            // Otherwise, check it against pluralization rules in $locale service.
            count = $locale.pluralCat(count - offset);
          }
  
          // If both `count` and `lastCount` are NaN, we don't need to re-register a watch.
          // In JS `NaN !== NaN`, so we have to explicitly check.
          if ((count !== lastCount) && !(countIsNaN && isNumberNaN(lastCount))) {
            watchRemover();
            var whenExpFn = whensExpFns[count];
            if (isUndefined(whenExpFn)) {
              if (newVal != null) {
                $log.debug('ngPluralize: no rule defined for \'' + count + '\' in ' + whenExp);
              }
              watchRemover = noop;
              updateElementText();
            } else {
              watchRemover = scope.$watch(whenExpFn, updateElementText);
            }
            lastCount = count;
          }
        });
  
        function updateElementText(newText) {
          element.text(newText || '');
        }
      }
    };
  }];
  
  /* exported ngRepeatDirective */
  
  /**
   * @ngdoc directive
   * @name ngRepeat
   * @multiElement
   * @restrict A
   *
   * @description
   * The `ngRepeat` directive instantiates a template once per item from a collection. Each template
   * instance gets its own scope, where the given loop variable is set to the current collection item,
   * and `$index` is set to the item index or key.
   *
   * Special properties are exposed on the local scope of each template instance, including:
   *
   * | Variable  | Type            | Details                                                                     |
   * |-----------|-----------------|-----------------------------------------------------------------------------|
   * | `$index`  | {@type number}  | iterator offset of the repeated element (0..length-1)                       |
   * | `$first`  | {@type boolean} | true if the repeated element is first in the iterator.                      |
   * | `$middle` | {@type boolean} | true if the repeated element is between the first and last in the iterator. |
   * | `$last`   | {@type boolean} | true if the repeated element is last in the iterator.                       |
   * | `$even`   | {@type boolean} | true if the iterator position `$index` is even (otherwise false).           |
   * | `$odd`    | {@type boolean} | true if the iterator position `$index` is odd (otherwise false).            |
   *
   * <div class="alert alert-info">
   *   Creating aliases for these properties is possible with {@link ng.directive:ngInit `ngInit`}.
   *   This may be useful when, for instance, nesting ngRepeats.
   * </div>
   *
   *
   * ## Iterating over object properties
   *
   * It is possible to get `ngRepeat` to iterate over the properties of an object using the following
   * syntax:
   *
   * ```js
   * <div ng-repeat="(key, value) in myObj"> ... </div>
   * ```
   *
   * However, there are a few limitations compared to array iteration:
   *
   * - The JavaScript specification does not define the order of keys
   *   returned for an object, so AngularJS relies on the order returned by the browser
   *   when running `for key in myObj`. Browsers generally follow the strategy of providing
   *   keys in the order in which they were defined, although there are exceptions when keys are deleted
   *   and reinstated. See the
   *   [MDN page on `delete` for more info](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete#Cross-browser_notes).
   *
   * - `ngRepeat` will silently *ignore* object keys starting with `$`, because
   *   it's a prefix used by AngularJS for public (`$`) and private (`$$`) properties.
   *
   * - The built-in filters {@link ng.orderBy orderBy} and {@link ng.filter filter} do not work with
   *   objects, and will throw an error if used with one.
   *
   * If you are hitting any of these limitations, the recommended workaround is to convert your object into an array
   * that is sorted into the order that you prefer before providing it to `ngRepeat`. You could
   * do this with a filter such as [toArrayFilter](http://ngmodules.org/modules/angular-toArrayFilter)
   * or implement a `$watch` on the object yourself.
   *
   *
   * ## Tracking and Duplicates
   *
   * `ngRepeat` uses {@link $rootScope.Scope#$watchCollection $watchCollection} to detect changes in
   * the collection. When a change happens, `ngRepeat` then makes the corresponding changes to the DOM:
   *
   * * When an item is added, a new instance of the template is added to the DOM.
   * * When an item is removed, its template instance is removed from the DOM.
   * * When items are reordered, their respective templates are reordered in the DOM.
   *
   * To minimize creation of DOM elements, `ngRepeat` uses a function
   * to "keep track" of all items in the collection and their corresponding DOM elements.
   * For example, if an item is added to the collection, `ngRepeat` will know that all other items
   * already have DOM elements, and will not re-render them.
   *
   * All different types of tracking functions, their syntax, and and their support for duplicate
   * items in collections can be found in the
   * {@link ngRepeat#ngRepeat-arguments ngRepeat expression description}.
   *
   * <div class="alert alert-success">
   * **Best Practice:** If you are working with objects that have a unique identifier property, you
   * should track by this identifier instead of the object instance,
   * e.g. `item in items track by item.id`.
   * Should you reload your data later, `ngRepeat` will not have to rebuild the DOM elements for items
   * it has already rendered, even if the JavaScript objects in the collection have been substituted
   * for new ones. For large collections, this significantly improves rendering performance.
   * </div>
   *
   * ### Effects of DOM Element re-use
   *
   * When DOM elements are re-used, ngRepeat updates the scope for the element, which will
   * automatically update any active bindings on the template. However, other
   * functionality will not be updated, because the element is not re-created:
   *
   * - Directives are not re-compiled
   * - {@link guide/expression#one-time-binding one-time expressions} on the repeated template are not
   * updated if they have stabilized.
   *
   * The above affects all kinds of element re-use due to tracking, but may be especially visible
   * when tracking by `$index` due to the way ngRepeat re-uses elements.
   *
   * The following example shows the effects of different actions with tracking:
  
    <example module="ngRepeat" name="ngRepeat-tracking" deps="angular-animate.js" animations="true">
      <file name="script.js">
        angular.module('ngRepeat', ['ngAnimate']).controller('repeatController', function($scope) {
          var friends = [
            {name:'John', age:25},
            {name:'Mary', age:40},
            {name:'Peter', age:85}
          ];
  
          $scope.removeFirst = function() {
            $scope.friends.shift();
          };
  
          $scope.updateAge = function() {
            $scope.friends.forEach(function(el) {
              el.age = el.age + 5;
            });
          };
  
          $scope.copy = function() {
            $scope.friends = angular.copy($scope.friends);
          };
  
          $scope.reset = function() {
            $scope.friends = angular.copy(friends);
          };
  
          $scope.reset();
        });
      </file>
      <file name="index.html">
        <div ng-controller="repeatController">
          <ol>
            <li>When you click "Update Age", only the first list updates the age, because all others have
            a one-time binding on the age property. If you then click "Copy", the current friend list
            is copied, and now the second list updates the age, because the identity of the collection items
            has changed and the list must be re-rendered. The 3rd and 4th list stay the same, because all the
            items are already known according to their tracking functions.
            </li>
            <li>When you click "Remove First", the 4th list has the wrong age on both remaining items. This is
            due to tracking by $index: when the first collection item is removed, ngRepeat reuses the first
            DOM element for the new first collection item, and so on. Since the age property is one-time
            bound, the value remains from the collection item which was previously at this index.
            </li>
          </ol>
  
          <button ng-click="removeFirst()">Remove First</button>
          <button ng-click="updateAge()">Update Age</button>
          <button ng-click="copy()">Copy</button>
          <br><button ng-click="reset()">Reset List</button>
          <br>
          <code>track by $id(friend)</code> (default):
          <ul class="example-animate-container">
            <li class="animate-repeat" ng-repeat="friend in friends">
              {{friend.name}} is {{friend.age}} years old.
            </li>
          </ul>
          <code>track by $id(friend)</code> (default), with age one-time binding:
          <ul class="example-animate-container">
            <li class="animate-repeat" ng-repeat="friend in friends">
              {{friend.name}} is {{::friend.age}} years old.
            </li>
          </ul>
          <code>track by friend.name</code>, with age one-time binding:
          <ul class="example-animate-container">
            <li class="animate-repeat" ng-repeat="friend in friends track by friend.name">
              {{friend.name}}  is {{::friend.age}} years old.
            </li>
          </ul>
          <code>track by $index</code>, with age one-time binding:
          <ul class="example-animate-container">
            <li class="animate-repeat" ng-repeat="friend in friends track by $index">
              {{friend.name}} is {{::friend.age}} years old.
            </li>
          </ul>
        </div>
      </file>
      <file name="animations.css">
        .example-animate-container {
          background:white;
          border:1px solid black;
          list-style:none;
          margin:0;
          padding:0 10px;
        }
  
        .animate-repeat {
          line-height:30px;
          list-style:none;
          box-sizing:border-box;
        }
  
        .animate-repeat.ng-move,
        .animate-repeat.ng-enter,
        .animate-repeat.ng-leave {
          transition:all linear 0.5s;
        }
  
        .animate-repeat.ng-leave.ng-leave-active,
        .animate-repeat.ng-move,
        .animate-repeat.ng-enter {
          opacity:0;
          max-height:0;
        }
  
        .animate-repeat.ng-leave,
        .animate-repeat.ng-move.ng-move-active,
        .animate-repeat.ng-enter.ng-enter-active {
          opacity:1;
          max-height:30px;
        }
      </file>
    </example>
  
   *
   * ## Special repeat start and end points
   * To repeat a series of elements instead of just one parent element, ngRepeat (as well as other ng directives) supports extending
   * the range of the repeater by defining explicit start and end points by using **ng-repeat-start** and **ng-repeat-end** respectively.
   * The **ng-repeat-start** directive works the same as **ng-repeat**, but will repeat all the HTML code (including the tag it's defined on)
   * up to and including the ending HTML tag where **ng-repeat-end** is placed.
   *
   * The example below makes use of this feature:
   * ```html
   *   <header ng-repeat-start="item in items">
   *     Header {{ item }}
   *   </header>
   *   <div class="body">
   *     Body {{ item }}
   *   </div>
   *   <footer ng-repeat-end>
   *     Footer {{ item }}
   *   </footer>
   * ```
   *
   * And with an input of {@type ['A','B']} for the items variable in the example above, the output will evaluate to:
   * ```html
   *   <header>
   *     Header A
   *   </header>
   *   <div class="body">
   *     Body A
   *   </div>
   *   <footer>
   *     Footer A
   *   </footer>
   *   <header>
   *     Header B
   *   </header>
   *   <div class="body">
   *     Body B
   *   </div>
   *   <footer>
   *     Footer B
   *   </footer>
   * ```
   *
   * The custom start and end points for ngRepeat also support all other HTML directive syntax flavors provided in AngularJS (such
   * as **data-ng-repeat-start**, **x-ng-repeat-start** and **ng:repeat-start**).
   *
   * @animations
   * | Animation                        | Occurs                              |
   * |----------------------------------|-------------------------------------|
   * | {@link ng.$animate#enter enter} | when a new item is added to the list or when an item is revealed after a filter |
   * | {@link ng.$animate#leave leave} | when an item is removed from the list or when an item is filtered out |
   * | {@link ng.$animate#move move } | when an adjacent item is filtered out causing a reorder or when the item contents are reordered |
   *
   * See the example below for defining CSS animations with ngRepeat.
   *
   * @element ANY
   * @scope
   * @priority 1000
   * @param {repeat_expression} ngRepeat The expression indicating how to enumerate a collection. These
   *   formats are currently supported:
   *
   *   * `variable in expression` â€“ where variable is the user defined loop variable and `expression`
   *     is a scope expression giving the collection to enumerate.
   *
   *     For example: `album in artist.albums`.
   *
   *   * `(key, value) in expression` â€“ where `key` and `value` can be any user defined identifiers,
   *     and `expression` is the scope expression giving the collection to enumerate.
   *
   *     For example: `(name, age) in {'adam':10, 'amalie':12}`.
   *
   *   * `variable in expression track by tracking_expression` â€“ You can also provide an optional tracking expression
   *     which can be used to associate the objects in the collection with the DOM elements. If no tracking expression
   *     is specified, ng-repeat associates elements by identity. It is an error to have
   *     more than one tracking expression value resolve to the same key. (This would mean that two distinct objects are
   *     mapped to the same DOM element, which is not possible.)
   *
   *     *Default tracking: $id()*: `item in items` is equivalent to `item in items track by $id(item)`.
   *     This implies that the DOM elements will be associated by item identity in the collection.
   *
   *     The built-in `$id()` function can be used to assign a unique
   *     `$$hashKey` property to each item in the collection. This property is then used as a key to associated DOM elements
   *     with the corresponding item in the collection by identity. Moving the same object would move
   *     the DOM element in the same way in the DOM.
   *     Note that the default id function does not support duplicate primitive values (`number`, `string`),
   *     but supports duplictae non-primitive values (`object`) that are *equal* in shape.
   *
   *     *Custom Expression*: It is possible to use any AngularJS expression to compute the tracking
   *     id, for example with a function, or using a property on the collection items.
   *     `item in items track by item.id` is a typical pattern when the items have a unique identifier,
   *     e.g. database id. In this case the object identity does not matter. Two objects are considered
   *     equivalent as long as their `id` property is same.
   *     Tracking by unique identifier is the most performant way and should be used whenever possible.
   *
   *     *$index*: This special property tracks the collection items by their index, and
   *     re-uses the DOM elements that match that index, e.g. `item in items track by $index`. This can
   *     be used for a performance improvement if no unique identfier is available and the identity of
   *     the collection items cannot be easily computed. It also allows duplicates.
   *
   *     <div class="alert alert-warning">
   *       <strong>Note:</strong> Re-using DOM elements can have unforeseen effects. Read the
   *       {@link ngRepeat#tracking-and-duplicates section on tracking and duplicates} for
   *       more info.
   *     </div>
   *
   *     <div class="alert alert-warning">
   *       <strong>Note:</strong> the `track by` expression must come last - after any filters, and the alias expression:
   *       `item in items | filter:searchText as results  track by item.id`
   *     </div>
   *
   *   * `variable in expression as alias_expression` â€“ You can also provide an optional alias expression which will then store the
   *     intermediate results of the repeater after the filters have been applied. Typically this is used to render a special message
   *     when a filter is active on the repeater, but the filtered result set is empty.
   *
   *     For example: `item in items | filter:x as results` will store the fragment of the repeated items as `results`, but only after
   *     the items have been processed through the filter.
   *
   *     Please note that `as [variable name] is not an operator but rather a part of ngRepeat
   *     micro-syntax so it can be used only after all filters (and not as operator, inside an expression).
   *
   *     For example: `item in items | filter : x | orderBy : order | limitTo : limit as results track by item.id` .
   *
   * @example
   * This example uses `ngRepeat` to display a list of people. A filter is used to restrict the displayed
   * results by name or by age. New (entering) and removed (leaving) items are animated.
    <example module="ngRepeat" name="ngRepeat" deps="angular-animate.js" animations="true">
      <file name="index.html">
        <div ng-controller="repeatController">
          I have {{friends.length}} friends. They are:
          <input type="search" ng-model="q" placeholder="filter friends..." aria-label="filter friends" />
          <ul class="example-animate-container">
            <li class="animate-repeat" ng-repeat="friend in friends | filter:q as results track by friend.name">
              [{{$index + 1}}] {{friend.name}} who is {{friend.age}} years old.
            </li>
            <li class="animate-repeat" ng-if="results.length === 0">
              <strong>No results found...</strong>
            </li>
          </ul>
        </div>
      </file>
      <file name="script.js">
        angular.module('ngRepeat', ['ngAnimate']).controller('repeatController', function($scope) {
          $scope.friends = [
            {name:'John', age:25, gender:'boy'},
            {name:'Jessie', age:30, gender:'girl'},
            {name:'Johanna', age:28, gender:'girl'},
            {name:'Joy', age:15, gender:'girl'},
            {name:'Mary', age:28, gender:'girl'},
            {name:'Peter', age:95, gender:'boy'},
            {name:'Sebastian', age:50, gender:'boy'},
            {name:'Erika', age:27, gender:'girl'},
            {name:'Patrick', age:40, gender:'boy'},
            {name:'Samantha', age:60, gender:'girl'}
          ];
        });
      </file>
      <file name="animations.css">
        .example-animate-container {
          background:white;
          border:1px solid black;
          list-style:none;
          margin:0;
          padding:0 10px;
        }
  
        .animate-repeat {
          line-height:30px;
          list-style:none;
          box-sizing:border-box;
        }
  
        .animate-repeat.ng-move,
        .animate-repeat.ng-enter,
        .animate-repeat.ng-leave {
          transition:all linear 0.5s;
        }
  
        .animate-repeat.ng-leave.ng-leave-active,
        .animate-repeat.ng-move,
        .animate-repeat.ng-enter {
          opacity:0;
          max-height:0;
        }
  
        .animate-repeat.ng-leave,
        .animate-repeat.ng-move.ng-move-active,
        .animate-repeat.ng-enter.ng-enter-active {
          opacity:1;
          max-height:30px;
        }
      </file>
      <file name="protractor.js" type="protractor">
        var friends = element.all(by.repeater('friend in friends'));
  
        it('should render initial data set', function() {
          expect(friends.count()).toBe(10);
          expect(friends.get(0).getText()).toEqual('[1] John who is 25 years old.');
          expect(friends.get(1).getText()).toEqual('[2] Jessie who is 30 years old.');
          expect(friends.last().getText()).toEqual('[10] Samantha who is 60 years old.');
          expect(element(by.binding('friends.length')).getText())
              .toMatch("I have 10 friends. They are:");
        });
  
         it('should update repeater when filter predicate changes', function() {
           expect(friends.count()).toBe(10);
  
           element(by.model('q')).sendKeys('ma');
  
           expect(friends.count()).toBe(2);
           expect(friends.get(0).getText()).toEqual('[1] Mary who is 28 years old.');
           expect(friends.last().getText()).toEqual('[2] Samantha who is 60 years old.');
         });
        </file>
      </example>
   */
  var ngRepeatDirective = ['$parse', '$animate', '$compile', function($parse, $animate, $compile) {
    var NG_REMOVED = '$$NG_REMOVED';
    var ngRepeatMinErr = minErr('ngRepeat');
  
    var updateScope = function(scope, index, valueIdentifier, value, keyIdentifier, key, arrayLength) {
      // TODO(perf): generate setters to shave off ~40ms or 1-1.5%
      scope[valueIdentifier] = value;
      if (keyIdentifier) scope[keyIdentifier] = key;
      scope.$index = index;
      scope.$first = (index === 0);
      scope.$last = (index === (arrayLength - 1));
      scope.$middle = !(scope.$first || scope.$last);
      // eslint-disable-next-line no-bitwise
      scope.$odd = !(scope.$even = (index & 1) === 0);
    };
  
    var getBlockStart = function(block) {
      return block.clone[0];
    };
  
    var getBlockEnd = function(block) {
      return block.clone[block.clone.length - 1];
    };
  
  
    return {
      restrict: 'A',
      multiElement: true,
      transclude: 'element',
      priority: 1000,
      terminal: true,
      $$tlb: true,
      compile: function ngRepeatCompile($element, $attr) {
        var expression = $attr.ngRepeat;
        var ngRepeatEndComment = $compile.$$createComment('end ngRepeat', expression);
  
        var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);
  
        if (!match) {
          throw ngRepeatMinErr('iexp', 'Expected expression in form of \'_item_ in _collection_[ track by _id_]\' but got \'{0}\'.',
              expression);
        }
  
        var lhs = match[1];
        var rhs = match[2];
        var aliasAs = match[3];
        var trackByExp = match[4];
  
        match = lhs.match(/^(?:(\s*[$\w]+)|\(\s*([$\w]+)\s*,\s*([$\w]+)\s*\))$/);
  
        if (!match) {
          throw ngRepeatMinErr('iidexp', '\'_item_\' in \'_item_ in _collection_\' should be an identifier or \'(_key_, _value_)\' expression, but got \'{0}\'.',
              lhs);
        }
        var valueIdentifier = match[3] || match[1];
        var keyIdentifier = match[2];
  
        if (aliasAs && (!/^[$a-zA-Z_][$a-zA-Z0-9_]*$/.test(aliasAs) ||
            /^(null|undefined|this|\$index|\$first|\$middle|\$last|\$even|\$odd|\$parent|\$root|\$id)$/.test(aliasAs))) {
          throw ngRepeatMinErr('badident', 'alias \'{0}\' is invalid --- must be a valid JS identifier which is not a reserved name.',
            aliasAs);
        }
  
        var trackByExpGetter, trackByIdExpFn, trackByIdArrayFn, trackByIdObjFn;
        var hashFnLocals = {$id: hashKey};
  
        if (trackByExp) {
          trackByExpGetter = $parse(trackByExp);
        } else {
          trackByIdArrayFn = function(key, value) {
            return hashKey(value);
          };
          trackByIdObjFn = function(key) {
            return key;
          };
        }
  
        return function ngRepeatLink($scope, $element, $attr, ctrl, $transclude) {
  
          if (trackByExpGetter) {
            trackByIdExpFn = function(key, value, index) {
              // assign key, value, and $index to the locals so that they can be used in hash functions
              if (keyIdentifier) hashFnLocals[keyIdentifier] = key;
              hashFnLocals[valueIdentifier] = value;
              hashFnLocals.$index = index;
              return trackByExpGetter($scope, hashFnLocals);
            };
          }
  
          // Store a list of elements from previous run. This is a hash where key is the item from the
          // iterator, and the value is objects with following properties.
          //   - scope: bound scope
          //   - clone: previous element.
          //   - index: position
          //
          // We are using no-proto object so that we don't need to guard against inherited props via
          // hasOwnProperty.
          var lastBlockMap = createMap();
  
          //watch props
          $scope.$watchCollection(rhs, function ngRepeatAction(collection) {
            var index, length,
                previousNode = $element[0],     // node that cloned nodes should be inserted after
                                                // initialized to the comment node anchor
                nextNode,
                // Same as lastBlockMap but it has the current state. It will become the
                // lastBlockMap on the next iteration.
                nextBlockMap = createMap(),
                collectionLength,
                key, value, // key/value of iteration
                trackById,
                trackByIdFn,
                collectionKeys,
                block,       // last object information {scope, element, id}
                nextBlockOrder,
                elementsToRemove;
  
            if (aliasAs) {
              $scope[aliasAs] = collection;
            }
  
            if (isArrayLike(collection)) {
              collectionKeys = collection;
              trackByIdFn = trackByIdExpFn || trackByIdArrayFn;
            } else {
              trackByIdFn = trackByIdExpFn || trackByIdObjFn;
              // if object, extract keys, in enumeration order, unsorted
              collectionKeys = [];
              for (var itemKey in collection) {
                if (hasOwnProperty.call(collection, itemKey) && itemKey.charAt(0) !== '$') {
                  collectionKeys.push(itemKey);
                }
              }
            }
  
            collectionLength = collectionKeys.length;
            nextBlockOrder = new Array(collectionLength);
  
            // locate existing items
            for (index = 0; index < collectionLength; index++) {
              key = (collection === collectionKeys) ? index : collectionKeys[index];
              value = collection[key];
              trackById = trackByIdFn(key, value, index);
              if (lastBlockMap[trackById]) {
                // found previously seen block
                block = lastBlockMap[trackById];
                delete lastBlockMap[trackById];
                nextBlockMap[trackById] = block;
                nextBlockOrder[index] = block;
              } else if (nextBlockMap[trackById]) {
                // if collision detected. restore lastBlockMap and throw an error
                forEach(nextBlockOrder, function(block) {
                  if (block && block.scope) lastBlockMap[block.id] = block;
                });
                throw ngRepeatMinErr('dupes',
                    'Duplicates in a repeater are not allowed. Use \'track by\' expression to specify unique keys. Repeater: {0}, Duplicate key: {1}, Duplicate value: {2}',
                    expression, trackById, value);
              } else {
                // new never before seen block
                nextBlockOrder[index] = {id: trackById, scope: undefined, clone: undefined};
                nextBlockMap[trackById] = true;
              }
            }
  
            // remove leftover items
            for (var blockKey in lastBlockMap) {
              block = lastBlockMap[blockKey];
              elementsToRemove = getBlockNodes(block.clone);
              $animate.leave(elementsToRemove);
              if (elementsToRemove[0].parentNode) {
                // if the element was not removed yet because of pending animation, mark it as deleted
                // so that we can ignore it later
                for (index = 0, length = elementsToRemove.length; index < length; index++) {
                  elementsToRemove[index][NG_REMOVED] = true;
                }
              }
              block.scope.$destroy();
            }
  
            // we are not using forEach for perf reasons (trying to avoid #call)
            for (index = 0; index < collectionLength; index++) {
              key = (collection === collectionKeys) ? index : collectionKeys[index];
              value = collection[key];
              block = nextBlockOrder[index];
  
              if (block.scope) {
                // if we have already seen this object, then we need to reuse the
                // associated scope/element
  
                nextNode = previousNode;
  
                // skip nodes that are already pending removal via leave animation
                do {
                  nextNode = nextNode.nextSibling;
                } while (nextNode && nextNode[NG_REMOVED]);
  
                if (getBlockStart(block) !== nextNode) {
                  // existing item which got moved
                  $animate.move(getBlockNodes(block.clone), null, previousNode);
                }
                previousNode = getBlockEnd(block);
                updateScope(block.scope, index, valueIdentifier, value, keyIdentifier, key, collectionLength);
              } else {
                // new item which we don't know about
                $transclude(function ngRepeatTransclude(clone, scope) {
                  block.scope = scope;
                  // http://jsperf.com/clone-vs-createcomment
                  var endNode = ngRepeatEndComment.cloneNode(false);
                  clone[clone.length++] = endNode;
  
                  $animate.enter(clone, null, previousNode);
                  previousNode = endNode;
                  // Note: We only need the first/last node of the cloned nodes.
                  // However, we need to keep the reference to the jqlite wrapper as it might be changed later
                  // by a directive with templateUrl when its template arrives.
                  block.clone = clone;
                  nextBlockMap[block.id] = block;
                  updateScope(block.scope, index, valueIdentifier, value, keyIdentifier, key, collectionLength);
                });
              }
            }
            lastBlockMap = nextBlockMap;
          });
        };
      }
    };
  }];
  
  var NG_HIDE_CLASS = 'ng-hide';
  var NG_HIDE_IN_PROGRESS_CLASS = 'ng-hide-animate';
  /**
   * @ngdoc directive
   * @name ngShow
   * @multiElement
   *
   * @description
   * The `ngShow` directive shows or hides the given HTML element based on the expression provided to
   * the `ngShow` attribute.
   *
   * The element is shown or hidden by removing or adding the `.ng-hide` CSS class onto the element.
   * The `.ng-hide` CSS class is predefined in AngularJS and sets the display style to none (using an
   * `!important` flag). For CSP mode please add `angular-csp.css` to your HTML file (see
   * {@link ng.directive:ngCsp ngCsp}).
   *
   * ```html
   * <!-- when $scope.myValue is truthy (element is visible) -->
   * <div ng-show="myValue"></div>
   *
   * <!-- when $scope.myValue is falsy (element is hidden) -->
   * <div ng-show="myValue" class="ng-hide"></div>
   * ```
   *
   * When the `ngShow` expression evaluates to a falsy value then the `.ng-hide` CSS class is added
   * to the class attribute on the element causing it to become hidden. When truthy, the `.ng-hide`
   * CSS class is removed from the element causing the element not to appear hidden.
   *
   * ## Why is `!important` used?
   *
   * You may be wondering why `!important` is used for the `.ng-hide` CSS class. This is because the
   * `.ng-hide` selector can be easily overridden by heavier selectors. For example, something as
   * simple as changing the display style on a HTML list item would make hidden elements appear
   * visible. This also becomes a bigger issue when dealing with CSS frameworks.
   *
   * By using `!important`, the show and hide behavior will work as expected despite any clash between
   * CSS selector specificity (when `!important` isn't used with any conflicting styles). If a
   * developer chooses to override the styling to change how to hide an element then it is just a
   * matter of using `!important` in their own CSS code.
   *
   * ### Overriding `.ng-hide`
   *
   * By default, the `.ng-hide` class will style the element with `display: none !important`. If you
   * wish to change the hide behavior with `ngShow`/`ngHide`, you can simply overwrite the styles for
   * the `.ng-hide` CSS class. Note that the selector that needs to be used is actually
   * `.ng-hide:not(.ng-hide-animate)` to cope with extra animation classes that can be added.
   *
   * ```css
   * .ng-hide:not(.ng-hide-animate) {
   *   /&#42; These are just alternative ways of hiding an element &#42;/
   *   display: block!important;
   *   position: absolute;
   *   top: -9999px;
   *   left: -9999px;
   * }
   * ```
   *
   * By default you don't need to override anything in CSS and the animations will work around the
   * display style.
   *
   * @animations
   * | Animation                                           | Occurs                                                                                                        |
   * |-----------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
   * | {@link $animate#addClass addClass} `.ng-hide`       | After the `ngShow` expression evaluates to a non truthy value and just before the contents are set to hidden. |
   * | {@link $animate#removeClass removeClass} `.ng-hide` | After the `ngShow` expression evaluates to a truthy value and just before contents are set to visible.        |
   *
   * Animations in `ngShow`/`ngHide` work with the show and hide events that are triggered when the
   * directive expression is true and false. This system works like the animation system present with
   * `ngClass` except that you must also include the `!important` flag to override the display
   * property so that the elements are not actually hidden during the animation.
   *
   * ```css
   * /&#42; A working example can be found at the bottom of this page. &#42;/
   * .my-element.ng-hide-add, .my-element.ng-hide-remove {
   *   transition: all 0.5s linear;
   * }
   *
   * .my-element.ng-hide-add { ... }
   * .my-element.ng-hide-add.ng-hide-add-active { ... }
   * .my-element.ng-hide-remove { ... }
   * .my-element.ng-hide-remove.ng-hide-remove-active { ... }
   * ```
   *
   * Keep in mind that, as of AngularJS version 1.3, there is no need to change the display property
   * to block during animation states - ngAnimate will automatically handle the style toggling for you.
   *
   * @element ANY
   * @param {expression} ngShow If the {@link guide/expression expression} is truthy/falsy then the
   *                            element is shown/hidden respectively.
   *
   * @example
   * A simple example, animating the element's opacity:
   *
    <example module="ngAnimate" deps="angular-animate.js" animations="true" name="ng-show-simple">
      <file name="index.html">
        Show: <input type="checkbox" ng-model="checked" aria-label="Toggle ngShow"><br />
        <div class="check-element animate-show-hide" ng-show="checked">
          I show up when your checkbox is checked.
        </div>
      </file>
      <file name="animations.css">
        .animate-show-hide.ng-hide {
          opacity: 0;
        }
  
        .animate-show-hide.ng-hide-add,
        .animate-show-hide.ng-hide-remove {
          transition: all linear 0.5s;
        }
  
        .check-element {
          border: 1px solid black;
          opacity: 1;
          padding: 10px;
        }
      </file>
      <file name="protractor.js" type="protractor">
        it('should check ngShow', function() {
          var checkbox = element(by.model('checked'));
          var checkElem = element(by.css('.check-element'));
  
          expect(checkElem.isDisplayed()).toBe(false);
          checkbox.click();
          expect(checkElem.isDisplayed()).toBe(true);
        });
      </file>
    </example>
   *
   * <hr />
   * @example
   * A more complex example, featuring different show/hide animations:
   *
    <example module="ngAnimate" deps="angular-animate.js" animations="true" name="ng-show-complex">
      <file name="index.html">
        Show: <input type="checkbox" ng-model="checked" aria-label="Toggle ngShow"><br />
        <div class="check-element funky-show-hide" ng-show="checked">
          I show up when your checkbox is checked.
        </div>
      </file>
      <file name="animations.css">
        body {
          overflow: hidden;
          perspective: 1000px;
        }
  
        .funky-show-hide.ng-hide-add {
          transform: rotateZ(0);
          transform-origin: right;
          transition: all 0.5s ease-in-out;
        }
  
        .funky-show-hide.ng-hide-add.ng-hide-add-active {
          transform: rotateZ(-135deg);
        }
  
        .funky-show-hide.ng-hide-remove {
          transform: rotateY(90deg);
          transform-origin: left;
          transition: all 0.5s ease;
        }
  
        .funky-show-hide.ng-hide-remove.ng-hide-remove-active {
          transform: rotateY(0);
        }
  
        .check-element {
          border: 1px solid black;
          opacity: 1;
          padding: 10px;
        }
      </file>
      <file name="protractor.js" type="protractor">
        it('should check ngShow', function() {
          var checkbox = element(by.model('checked'));
          var checkElem = element(by.css('.check-element'));
  
          expect(checkElem.isDisplayed()).toBe(false);
          checkbox.click();
          expect(checkElem.isDisplayed()).toBe(true);
        });
      </file>
    </example>
   */
  var ngShowDirective = ['$animate', function($animate) {
    return {
      restrict: 'A',
      multiElement: true,
      link: function(scope, element, attr) {
        scope.$watch(attr.ngShow, function ngShowWatchAction(value) {
          // we're adding a temporary, animation-specific class for ng-hide since this way
          // we can control when the element is actually displayed on screen without having
          // to have a global/greedy CSS selector that breaks when other animations are run.
          // Read: https://github.com/angular/angular.js/issues/9103#issuecomment-58335845
          $animate[value ? 'removeClass' : 'addClass'](element, NG_HIDE_CLASS, {
            tempClasses: NG_HIDE_IN_PROGRESS_CLASS
          });
        });
      }
    };
  }];
  
  
  /**
   * @ngdoc directive
   * @name ngHide
   * @multiElement
   *
   * @description
   * The `ngHide` directive shows or hides the given HTML element based on the expression provided to
   * the `ngHide` attribute.
   *
   * The element is shown or hidden by removing or adding the `.ng-hide` CSS class onto the element.
   * The `.ng-hide` CSS class is predefined in AngularJS and sets the display style to none (using an
   * `!important` flag). For CSP mode please add `angular-csp.css` to your HTML file (see
   * {@link ng.directive:ngCsp ngCsp}).
   *
   * ```html
   * <!-- when $scope.myValue is truthy (element is hidden) -->
   * <div ng-hide="myValue" class="ng-hide"></div>
   *
   * <!-- when $scope.myValue is falsy (element is visible) -->
   * <div ng-hide="myValue"></div>
   * ```
   *
   * When the `ngHide` expression evaluates to a truthy value then the `.ng-hide` CSS class is added
   * to the class attribute on the element causing it to become hidden. When falsy, the `.ng-hide`
   * CSS class is removed from the element causing the element not to appear hidden.
   *
   * ## Why is `!important` used?
   *
   * You may be wondering why `!important` is used for the `.ng-hide` CSS class. This is because the
   * `.ng-hide` selector can be easily overridden by heavier selectors. For example, something as
   * simple as changing the display style on a HTML list item would make hidden elements appear
   * visible. This also becomes a bigger issue when dealing with CSS frameworks.
   *
   * By using `!important`, the show and hide behavior will work as expected despite any clash between
   * CSS selector specificity (when `!important` isn't used with any conflicting styles). If a
   * developer chooses to override the styling to change how to hide an element then it is just a
   * matter of using `!important` in their own CSS code.
   *
   * ### Overriding `.ng-hide`
   *
   * By default, the `.ng-hide` class will style the element with `display: none !important`. If you
   * wish to change the hide behavior with `ngShow`/`ngHide`, you can simply overwrite the styles for
   * the `.ng-hide` CSS class. Note that the selector that needs to be used is actually
   * `.ng-hide:not(.ng-hide-animate)` to cope with extra animation classes that can be added.
   *
   * ```css
   * .ng-hide:not(.ng-hide-animate) {
   *   /&#42; These are just alternative ways of hiding an element &#42;/
   *   display: block!important;
   *   position: absolute;
   *   top: -9999px;
   *   left: -9999px;
   * }
   * ```
   *
   * By default you don't need to override in CSS anything and the animations will work around the
   * display style.
   *
   * @animations
   * | Animation                                           | Occurs                                                                                                     |
   * |-----------------------------------------------------|------------------------------------------------------------------------------------------------------------|
   * | {@link $animate#addClass addClass} `.ng-hide`       | After the `ngHide` expression evaluates to a truthy value and just before the contents are set to hidden.  |
   * | {@link $animate#removeClass removeClass} `.ng-hide` | After the `ngHide` expression evaluates to a non truthy value and just before contents are set to visible. |
   *
   * Animations in `ngShow`/`ngHide` work with the show and hide events that are triggered when the
   * directive expression is true and false. This system works like the animation system present with
   * `ngClass` except that you must also include the `!important` flag to override the display
   * property so that the elements are not actually hidden during the animation.
   *
   * ```css
   * /&#42; A working example can be found at the bottom of this page. &#42;/
   * .my-element.ng-hide-add, .my-element.ng-hide-remove {
   *   transition: all 0.5s linear;
   * }
   *
   * .my-element.ng-hide-add { ... }
   * .my-element.ng-hide-add.ng-hide-add-active { ... }
   * .my-element.ng-hide-remove { ... }
   * .my-element.ng-hide-remove.ng-hide-remove-active { ... }
   * ```
   *
   * Keep in mind that, as of AngularJS version 1.3, there is no need to change the display property
   * to block during animation states - ngAnimate will automatically handle the style toggling for you.
   *
   * @element ANY
   * @param {expression} ngHide If the {@link guide/expression expression} is truthy/falsy then the
   *                            element is hidden/shown respectively.
   *
   * @example
   * A simple example, animating the element's opacity:
   *
    <example module="ngAnimate" deps="angular-animate.js" animations="true" name="ng-hide-simple">
      <file name="index.html">
        Hide: <input type="checkbox" ng-model="checked" aria-label="Toggle ngHide"><br />
        <div class="check-element animate-show-hide" ng-hide="checked">
          I hide when your checkbox is checked.
        </div>
      </file>
      <file name="animations.css">
        .animate-show-hide.ng-hide {
          opacity: 0;
        }
  
        .animate-show-hide.ng-hide-add,
        .animate-show-hide.ng-hide-remove {
          transition: all linear 0.5s;
        }
  
        .check-element {
          border: 1px solid black;
          opacity: 1;
          padding: 10px;
        }
      </file>
      <file name="protractor.js" type="protractor">
        it('should check ngHide', function() {
          var checkbox = element(by.model('checked'));
          var checkElem = element(by.css('.check-element'));
  
          expect(checkElem.isDisplayed()).toBe(true);
          checkbox.click();
          expect(checkElem.isDisplayed()).toBe(false);
        });
      </file>
    </example>
   *
   * <hr />
   * @example
   * A more complex example, featuring different show/hide animations:
   *
    <example module="ngAnimate" deps="angular-animate.js" animations="true" name="ng-hide-complex">
      <file name="index.html">
        Hide: <input type="checkbox" ng-model="checked" aria-label="Toggle ngHide"><br />
        <div class="check-element funky-show-hide" ng-hide="checked">
          I hide when your checkbox is checked.
        </div>
      </file>
      <file name="animations.css">
        body {
          overflow: hidden;
          perspective: 1000px;
        }
  
        .funky-show-hide.ng-hide-add {
          transform: rotateZ(0);
          transform-origin: right;
          transition: all 0.5s ease-in-out;
        }
  
        .funky-show-hide.ng-hide-add.ng-hide-add-active {
          transform: rotateZ(-135deg);
        }
  
        .funky-show-hide.ng-hide-remove {
          transform: rotateY(90deg);
          transform-origin: left;
          transition: all 0.5s ease;
        }
  
        .funky-show-hide.ng-hide-remove.ng-hide-remove-active {
          transform: rotateY(0);
        }
  
        .check-element {
          border: 1px solid black;
          opacity: 1;
          padding: 10px;
        }
      </file>
      <file name="protractor.js" type="protractor">
        it('should check ngHide', function() {
          var checkbox = element(by.model('checked'));
          var checkElem = element(by.css('.check-element'));
  
          expect(checkElem.isDisplayed()).toBe(true);
          checkbox.click();
          expect(checkElem.isDisplayed()).toBe(false);
        });
      </file>
    </example>
   */
  var ngHideDirective = ['$animate', function($animate) {
    return {
      restrict: 'A',
      multiElement: true,
      link: function(scope, element, attr) {
        scope.$watch(attr.ngHide, function ngHideWatchAction(value) {
          // The comment inside of the ngShowDirective explains why we add and
          // remove a temporary class for the show/hide animation
          $animate[value ? 'addClass' : 'removeClass'](element,NG_HIDE_CLASS, {
            tempClasses: NG_HIDE_IN_PROGRESS_CLASS
          });
        });
      }
    };
  }];
  
  /**
   * @ngdoc directive
   * @name ngStyle
   * @restrict AC
   *
   * @description
   * The `ngStyle` directive allows you to set CSS style on an HTML element conditionally.
   *
   * @knownIssue
   * You should not use {@link guide/interpolation interpolation} in the value of the `style`
   * attribute, when using the `ngStyle` directive on the same element.
   * See {@link guide/interpolation#known-issues here} for more info.
   *
   * @element ANY
   * @param {expression} ngStyle
   *
   * {@link guide/expression Expression} which evals to an
   * object whose keys are CSS style names and values are corresponding values for those CSS
   * keys.
   *
   * Since some CSS style names are not valid keys for an object, they must be quoted.
   * See the 'background-color' style in the example below.
   *
   * @example
     <example name="ng-style">
       <file name="index.html">
          <input type="button" value="set color" ng-click="myStyle={color:'red'}">
          <input type="button" value="set background" ng-click="myStyle={'background-color':'blue'}">
          <input type="button" value="clear" ng-click="myStyle={}">
          <br/>
          <span ng-style="myStyle">Sample Text</span>
          <pre>myStyle={{myStyle}}</pre>
       </file>
       <file name="style.css">
         span {
           color: black;
         }
       </file>
       <file name="protractor.js" type="protractor">
         var colorSpan = element(by.css('span'));
  
         it('should check ng-style', function() {
           expect(colorSpan.getCssValue('color')).toBe('rgba(0, 0, 0, 1)');
           element(by.css('input[value=\'set color\']')).click();
           expect(colorSpan.getCssValue('color')).toBe('rgba(255, 0, 0, 1)');
           element(by.css('input[value=clear]')).click();
           expect(colorSpan.getCssValue('color')).toBe('rgba(0, 0, 0, 1)');
         });
       </file>
     </example>
   */
  var ngStyleDirective = ngDirective(function(scope, element, attr) {
    scope.$watch(attr.ngStyle, function ngStyleWatchAction(newStyles, oldStyles) {
      if (oldStyles && (newStyles !== oldStyles)) {
        forEach(oldStyles, function(val, style) { element.css(style, '');});
      }
      if (newStyles) element.css(newStyles);
    }, true);
  });
  
  /**
   * @ngdoc directive
   * @name ngSwitch
   * @restrict EA
   *
   * @description
   * The `ngSwitch` directive is used to conditionally swap DOM structure on your template based on a scope expression.
   * Elements within `ngSwitch` but without `ngSwitchWhen` or `ngSwitchDefault` directives will be preserved at the location
   * as specified in the template.
   *
   * The directive itself works similar to ngInclude, however, instead of downloading template code (or loading it
   * from the template cache), `ngSwitch` simply chooses one of the nested elements and makes it visible based on which element
   * matches the value obtained from the evaluated expression. In other words, you define a container element
   * (where you place the directive), place an expression on the **`on="..."` attribute**
   * (or the **`ng-switch="..."` attribute**), define any inner elements inside of the directive and place
   * a when attribute per element. The when attribute is used to inform ngSwitch which element to display when the on
   * expression is evaluated. If a matching expression is not found via a when attribute then an element with the default
   * attribute is displayed.
   *
   * <div class="alert alert-info">
   * Be aware that the attribute values to match against cannot be expressions. They are interpreted
   * as literal string values to match against.
   * For example, **`ng-switch-when="someVal"`** will match against the string `"someVal"` not against the
   * value of the expression `$scope.someVal`.
   * </div>
  
   * @animations
   * | Animation                        | Occurs                              |
   * |----------------------------------|-------------------------------------|
   * | {@link ng.$animate#enter enter}  | after the ngSwitch contents change and the matched child element is placed inside the container |
   * | {@link ng.$animate#leave leave}  | after the ngSwitch contents change and just before the former contents are removed from the DOM |
   *
   * @usage
   *
   * ```
   * <ANY ng-switch="expression">
   *   <ANY ng-switch-when="matchValue1">...</ANY>
   *   <ANY ng-switch-when="matchValue2">...</ANY>
   *   <ANY ng-switch-default>...</ANY>
   * </ANY>
   * ```
   *
   *
   * @scope
   * @priority 1200
   * @param {*} ngSwitch|on expression to match against <code>ng-switch-when</code>.
   * On child elements add:
   *
   * * `ngSwitchWhen`: the case statement to match against. If match then this
   *   case will be displayed. If the same match appears multiple times, all the
   *   elements will be displayed. It is possible to associate multiple values to
   *   the same `ngSwitchWhen` by defining the optional attribute
   *   `ngSwitchWhenSeparator`. The separator will be used to split the value of
   *   the `ngSwitchWhen` attribute into multiple tokens, and the element will show
   *   if any of the `ngSwitch` evaluates to any of these tokens.
   * * `ngSwitchDefault`: the default case when no other case match. If there
   *   are multiple default cases, all of them will be displayed when no other
   *   case match.
   *
   *
   * @example
    <example module="switchExample" deps="angular-animate.js" animations="true" name="ng-switch">
      <file name="index.html">
        <div ng-controller="ExampleController">
          <select ng-model="selection" ng-options="item for item in items">
          </select>
          <code>selection={{selection}}</code>
          <hr/>
          <div class="animate-switch-container"
            ng-switch on="selection">
              <div class="animate-switch" ng-switch-when="settings|options" ng-switch-when-separator="|">Settings Div</div>
              <div class="animate-switch" ng-switch-when="home">Home Span</div>
              <div class="animate-switch" ng-switch-default>default</div>
          </div>
        </div>
      </file>
      <file name="script.js">
        angular.module('switchExample', ['ngAnimate'])
          .controller('ExampleController', ['$scope', function($scope) {
            $scope.items = ['settings', 'home', 'options', 'other'];
            $scope.selection = $scope.items[0];
          }]);
      </file>
      <file name="animations.css">
        .animate-switch-container {
          position:relative;
          background:white;
          border:1px solid black;
          height:40px;
          overflow:hidden;
        }
  
        .animate-switch {
          padding:10px;
        }
  
        .animate-switch.ng-animate {
          transition:all cubic-bezier(0.250, 0.460, 0.450, 0.940) 0.5s;
  
          position:absolute;
          top:0;
          left:0;
          right:0;
          bottom:0;
        }
  
        .animate-switch.ng-leave.ng-leave-active,
        .animate-switch.ng-enter {
          top:-50px;
        }
        .animate-switch.ng-leave,
        .animate-switch.ng-enter.ng-enter-active {
          top:0;
        }
      </file>
      <file name="protractor.js" type="protractor">
        var switchElem = element(by.css('[ng-switch]'));
        var select = element(by.model('selection'));
  
        it('should start in settings', function() {
          expect(switchElem.getText()).toMatch(/Settings Div/);
        });
        it('should change to home', function() {
          select.all(by.css('option')).get(1).click();
          expect(switchElem.getText()).toMatch(/Home Span/);
        });
        it('should change to settings via "options"', function() {
          select.all(by.css('option')).get(2).click();
          expect(switchElem.getText()).toMatch(/Settings Div/);
        });
        it('should select default', function() {
          select.all(by.css('option')).get(3).click();
          expect(switchElem.getText()).toMatch(/default/);
        });
      </file>
    </example>
   */
  var ngSwitchDirective = ['$animate', '$compile', function($animate, $compile) {
    return {
      require: 'ngSwitch',
  
      // asks for $scope to fool the BC controller module
      controller: ['$scope', function NgSwitchController() {
       this.cases = {};
      }],
      link: function(scope, element, attr, ngSwitchController) {
        var watchExpr = attr.ngSwitch || attr.on,
            selectedTranscludes = [],
            selectedElements = [],
            previousLeaveAnimations = [],
            selectedScopes = [];
  
        var spliceFactory = function(array, index) {
            return function(response) {
              if (response !== false) array.splice(index, 1);
            };
        };
  
        scope.$watch(watchExpr, function ngSwitchWatchAction(value) {
          var i, ii;
  
          // Start with the last, in case the array is modified during the loop
          while (previousLeaveAnimations.length) {
            $animate.cancel(previousLeaveAnimations.pop());
          }
  
          for (i = 0, ii = selectedScopes.length; i < ii; ++i) {
            var selected = getBlockNodes(selectedElements[i].clone);
            selectedScopes[i].$destroy();
            var runner = previousLeaveAnimations[i] = $animate.leave(selected);
            runner.done(spliceFactory(previousLeaveAnimations, i));
          }
  
          selectedElements.length = 0;
          selectedScopes.length = 0;
  
          if ((selectedTranscludes = ngSwitchController.cases['!' + value] || ngSwitchController.cases['?'])) {
            forEach(selectedTranscludes, function(selectedTransclude) {
              selectedTransclude.transclude(function(caseElement, selectedScope) {
                selectedScopes.push(selectedScope);
                var anchor = selectedTransclude.element;
                caseElement[caseElement.length++] = $compile.$$createComment('end ngSwitchWhen');
                var block = { clone: caseElement };
  
                selectedElements.push(block);
                $animate.enter(caseElement, anchor.parent(), anchor);
              });
            });
          }
        });
      }
    };
  }];
  
  var ngSwitchWhenDirective = ngDirective({
    transclude: 'element',
    priority: 1200,
    require: '^ngSwitch',
    multiElement: true,
    link: function(scope, element, attrs, ctrl, $transclude) {
  
      var cases = attrs.ngSwitchWhen.split(attrs.ngSwitchWhenSeparator).sort().filter(
        // Filter duplicate cases
        function(element, index, array) { return array[index - 1] !== element; }
      );
  
      forEach(cases, function(whenCase) {
        ctrl.cases['!' + whenCase] = (ctrl.cases['!' + whenCase] || []);
        ctrl.cases['!' + whenCase].push({ transclude: $transclude, element: element });
      });
    }
  });
  
  var ngSwitchDefaultDirective = ngDirective({
    transclude: 'element',
    priority: 1200,
    require: '^ngSwitch',
    multiElement: true,
    link: function(scope, element, attr, ctrl, $transclude) {
      ctrl.cases['?'] = (ctrl.cases['?'] || []);
      ctrl.cases['?'].push({ transclude: $transclude, element: element });
     }
  });
  
  /**
   * @ngdoc directive
   * @name ngTransclude
   * @restrict EAC
   *
   * @description
   * Directive that marks the insertion point for the transcluded DOM of the nearest parent directive that uses transclusion.
   *
   * You can specify that you want to insert a named transclusion slot, instead of the default slot, by providing the slot name
   * as the value of the `ng-transclude` or `ng-transclude-slot` attribute.
   *
   * If the transcluded content is not empty (i.e. contains one or more DOM nodes, including whitespace text nodes), any existing
   * content of this element will be removed before the transcluded content is inserted.
   * If the transcluded content is empty (or only whitespace), the existing content is left intact. This lets you provide fallback
   * content in the case that no transcluded content is provided.
   *
   * @element ANY
   *
   * @param {string} ngTransclude|ngTranscludeSlot the name of the slot to insert at this point. If this is not provided, is empty
   *                                               or its value is the same as the name of the attribute then the default slot is used.
   *
   * @example
   * ### Basic transclusion
   * This example demonstrates basic transclusion of content into a component directive.
   * <example name="simpleTranscludeExample" module="transcludeExample">
   *   <file name="index.html">
   *     <script>
   *       angular.module('transcludeExample', [])
   *        .directive('pane', function(){
   *           return {
   *             restrict: 'E',
   *             transclude: true,
   *             scope: { title:'@' },
   *             template: '<div style="border: 1px solid black;">' +
   *                         '<div style="background-color: gray">{{title}}</div>' +
   *                         '<ng-transclude></ng-transclude>' +
   *                       '</div>'
   *           };
   *       })
   *       .controller('ExampleController', ['$scope', function($scope) {
   *         $scope.title = 'Lorem Ipsum';
   *         $scope.text = 'Neque porro quisquam est qui dolorem ipsum quia dolor...';
   *       }]);
   *     </script>
   *     <div ng-controller="ExampleController">
   *       <input ng-model="title" aria-label="title"> <br/>
   *       <textarea ng-model="text" aria-label="text"></textarea> <br/>
   *       <pane title="{{title}}"><span>{{text}}</span></pane>
   *     </div>
   *   </file>
   *   <file name="protractor.js" type="protractor">
   *      it('should have transcluded', function() {
   *        var titleElement = element(by.model('title'));
   *        titleElement.clear();
   *        titleElement.sendKeys('TITLE');
   *        var textElement = element(by.model('text'));
   *        textElement.clear();
   *        textElement.sendKeys('TEXT');
   *        expect(element(by.binding('title')).getText()).toEqual('TITLE');
   *        expect(element(by.binding('text')).getText()).toEqual('TEXT');
   *      });
   *   </file>
   * </example>
   *
   * @example
   * ### Transclude fallback content
   * This example shows how to use `NgTransclude` with fallback content, that
   * is displayed if no transcluded content is provided.
   *
   * <example module="transcludeFallbackContentExample" name="ng-transclude">
   * <file name="index.html">
   * <script>
   * angular.module('transcludeFallbackContentExample', [])
   * .directive('myButton', function(){
   *             return {
   *               restrict: 'E',
   *               transclude: true,
   *               scope: true,
   *               template: '<button style="cursor: pointer;">' +
   *                           '<ng-transclude>' +
   *                             '<b style="color: red;">Button1</b>' +
   *                           '</ng-transclude>' +
   *                         '</button>'
   *             };
   *         });
   * </script>
   * <!-- fallback button content -->
   * <my-button id="fallback"></my-button>
   * <!-- modified button content -->
   * <my-button id="modified">
   *   <i style="color: green;">Button2</i>
   * </my-button>
   * </file>
   * <file name="protractor.js" type="protractor">
   * it('should have different transclude element content', function() {
   *          expect(element(by.id('fallback')).getText()).toBe('Button1');
   *          expect(element(by.id('modified')).getText()).toBe('Button2');
   *        });
   * </file>
   * </example>
   *
   * @example
   * ### Multi-slot transclusion
   * This example demonstrates using multi-slot transclusion in a component directive.
   * <example name="multiSlotTranscludeExample" module="multiSlotTranscludeExample">
   *   <file name="index.html">
   *    <style>
   *      .title, .footer {
   *        background-color: gray
   *      }
   *    </style>
   *    <div ng-controller="ExampleController">
   *      <input ng-model="title" aria-label="title"> <br/>
   *      <textarea ng-model="text" aria-label="text"></textarea> <br/>
   *      <pane>
   *        <pane-title><a ng-href="{{link}}">{{title}}</a></pane-title>
   *        <pane-body><p>{{text}}</p></pane-body>
   *      </pane>
   *    </div>
   *   </file>
   *   <file name="app.js">
   *    angular.module('multiSlotTranscludeExample', [])
   *     .directive('pane', function() {
   *        return {
   *          restrict: 'E',
   *          transclude: {
   *            'title': '?paneTitle',
   *            'body': 'paneBody',
   *            'footer': '?paneFooter'
   *          },
   *          template: '<div style="border: 1px solid black;">' +
   *                      '<div class="title" ng-transclude="title">Fallback Title</div>' +
   *                      '<div ng-transclude="body"></div>' +
   *                      '<div class="footer" ng-transclude="footer">Fallback Footer</div>' +
   *                    '</div>'
   *        };
   *    })
   *    .controller('ExampleController', ['$scope', function($scope) {
   *      $scope.title = 'Lorem Ipsum';
   *      $scope.link = 'https://google.com';
   *      $scope.text = 'Neque porro quisquam est qui dolorem ipsum quia dolor...';
   *    }]);
   *   </file>
   *   <file name="protractor.js" type="protractor">
   *      it('should have transcluded the title and the body', function() {
   *        var titleElement = element(by.model('title'));
   *        titleElement.clear();
   *        titleElement.sendKeys('TITLE');
   *        var textElement = element(by.model('text'));
   *        textElement.clear();
   *        textElement.sendKeys('TEXT');
   *        expect(element(by.css('.title')).getText()).toEqual('TITLE');
   *        expect(element(by.binding('text')).getText()).toEqual('TEXT');
   *        expect(element(by.css('.footer')).getText()).toEqual('Fallback Footer');
   *      });
   *   </file>
   * </example>
   */
  var ngTranscludeMinErr = minErr('ngTransclude');
  var ngTranscludeDirective = ['$compile', function($compile) {
    return {
      restrict: 'EAC',
      compile: function ngTranscludeCompile(tElement) {
  
        // Remove and cache any original content to act as a fallback
        var fallbackLinkFn = $compile(tElement.contents());
        tElement.empty();
  
        return function ngTranscludePostLink($scope, $element, $attrs, controller, $transclude) {
  
          if (!$transclude) {
            throw ngTranscludeMinErr('orphan',
            'Illegal use of ngTransclude directive in the template! ' +
            'No parent directive that requires a transclusion found. ' +
            'Element: {0}',
            startingTag($element));
          }
  
  
          // If the attribute is of the form: `ng-transclude="ng-transclude"` then treat it like the default
          if ($attrs.ngTransclude === $attrs.$attr.ngTransclude) {
            $attrs.ngTransclude = '';
          }
          var slotName = $attrs.ngTransclude || $attrs.ngTranscludeSlot;
  
          // If the slot is required and no transclusion content is provided then this call will throw an error
          $transclude(ngTranscludeCloneAttachFn, null, slotName);
  
          // If the slot is optional and no transclusion content is provided then use the fallback content
          if (slotName && !$transclude.isSlotFilled(slotName)) {
            useFallbackContent();
          }
  
          function ngTranscludeCloneAttachFn(clone, transcludedScope) {
            if (clone.length && notWhitespace(clone)) {
              $element.append(clone);
            } else {
              useFallbackContent();
              // There is nothing linked against the transcluded scope since no content was available,
              // so it should be safe to clean up the generated scope.
              transcludedScope.$destroy();
            }
          }
  
          function useFallbackContent() {
            // Since this is the fallback content rather than the transcluded content,
            // we link against the scope of this directive rather than the transcluded scope
            fallbackLinkFn($scope, function(clone) {
              $element.append(clone);
            });
          }
  
          function notWhitespace(nodes) {
            for (var i = 0, ii = nodes.length; i < ii; i++) {
              var node = nodes[i];
              if (node.nodeType !== NODE_TYPE_TEXT || node.nodeValue.trim()) {
                return true;
              }
            }
          }
        };
      }
    };
  }];
  
  /**
   * @ngdoc directive
   * @name script
   * @restrict E
   *
   * @description
   * Load the content of a `<script>` element into {@link ng.$templateCache `$templateCache`}, so that the
   * template can be used by {@link ng.directive:ngInclude `ngInclude`},
   * {@link ngRoute.directive:ngView `ngView`}, or {@link guide/directive directives}. The type of the
   * `<script>` element must be specified as `text/ng-template`, and a cache name for the template must be
   * assigned through the element's `id`, which can then be used as a directive's `templateUrl`.
   *
   * @param {string} type Must be set to `'text/ng-template'`.
   * @param {string} id Cache name of the template.
   *
   * @example
    <example  name="script-tag">
      <file name="index.html">
        <script type="text/ng-template" id="/tpl.html">
          Content of the template.
        </script>
  
        <a ng-click="currentTpl='/tpl.html'" id="tpl-link">Load inlined template</a>
        <div id="tpl-content" ng-include src="currentTpl"></div>
      </file>
      <file name="protractor.js" type="protractor">
        it('should load template defined inside script tag', function() {
          element(by.css('#tpl-link')).click();
          expect(element(by.css('#tpl-content')).getText()).toMatch(/Content of the template/);
        });
      </file>
    </example>
   */
  var scriptDirective = ['$templateCache', function($templateCache) {
    return {
      restrict: 'E',
      terminal: true,
      compile: function(element, attr) {
        if (attr.type === 'text/ng-template') {
          var templateUrl = attr.id,
              text = element[0].text;
  
          $templateCache.put(templateUrl, text);
        }
      }
    };
  }];
  
  /* exported selectDirective, optionDirective */
  
  var noopNgModelController = { $setViewValue: noop, $render: noop };
  
  function setOptionSelectedStatus(optionEl, value) {
    optionEl.prop('selected', value);
    /**
     * When unselecting an option, setting the property to null / false should be enough
     * However, screenreaders might react to the selected attribute instead, see
     * https://github.com/angular/angular.js/issues/14419
     * Note: "selected" is a boolean attr and will be removed when the "value" arg in attr() is false
     * or null
     */
    optionEl.attr('selected', value);
  }
  
  /**
   * @ngdoc type
   * @name  select.SelectController
   *
   * @description
   * The controller for the {@link ng.select select} directive. The controller exposes
   * a few utility methods that can be used to augment the behavior of a regular or an
   * {@link ng.ngOptions ngOptions} select element.
   *
   * @example
   * ### Set a custom error when the unknown option is selected
   *
   * This example sets a custom error "unknownValue" on the ngModelController
   * when the select element's unknown option is selected, i.e. when the model is set to a value
   * that is not matched by any option.
   *
   * <example name="select-unknown-value-error" module="staticSelect">
   * <file name="index.html">
   * <div ng-controller="ExampleController">
   *   <form name="myForm">
   *     <label for="testSelect"> Single select: </label><br>
   *     <select name="testSelect" ng-model="selected" unknown-value-error>
   *       <option value="option-1">Option 1</option>
   *       <option value="option-2">Option 2</option>
   *     </select><br>
   *     <span class="error" ng-if="myForm.testSelect.$error.unknownValue">
   *       Error: The current model doesn't match any option</span><br>
   *
   *     <button ng-click="forceUnknownOption()">Force unknown option</button><br>
   *   </form>
   * </div>
   * </file>
   * <file name="app.js">
   *  angular.module('staticSelect', [])
   *    .controller('ExampleController', ['$scope', function($scope) {
   *      $scope.selected = null;
   *
   *      $scope.forceUnknownOption = function() {
   *        $scope.selected = 'nonsense';
   *      };
   *   }])
   *   .directive('unknownValueError', function() {
   *     return {
   *       require: ['ngModel', 'select'],
   *       link: function(scope, element, attrs, ctrls) {
   *         var ngModelCtrl = ctrls[0];
   *         var selectCtrl = ctrls[1];
   *
   *         ngModelCtrl.$validators.unknownValue = function(modelValue, viewValue) {
   *           if (selectCtrl.$isUnknownOptionSelected()) {
   *             return false;
   *           }
   *
   *           return true;
   *         };
   *       }
   *
   *     };
   *   });
   * </file>
   *</example>
   *
   *
   * @example
   * ### Set the "required" error when the unknown option is selected.
   *
   * By default, the "required" error on the ngModelController is only set on a required select
   * when the empty option is selected. This example adds a custom directive that also sets the
   * error when the unknown option is selected.
   *
   * <example name="select-unknown-value-required" module="staticSelect">
   * <file name="index.html">
   * <div ng-controller="ExampleController">
   *   <form name="myForm">
   *     <label for="testSelect"> Select: </label><br>
   *     <select name="testSelect" ng-model="selected" required unknown-value-required>
   *       <option value="option-1">Option 1</option>
   *       <option value="option-2">Option 2</option>
   *     </select><br>
   *     <span class="error" ng-if="myForm.testSelect.$error.required">Error: Please select a value</span><br>
   *
   *     <button ng-click="forceUnknownOption()">Force unknown option</button><br>
   *   </form>
   * </div>
   * </file>
   * <file name="app.js">
   *  angular.module('staticSelect', [])
   *    .controller('ExampleController', ['$scope', function($scope) {
   *      $scope.selected = null;
   *
   *      $scope.forceUnknownOption = function() {
   *        $scope.selected = 'nonsense';
   *      };
   *   }])
   *   .directive('unknownValueRequired', function() {
   *     return {
   *       priority: 1, // This directive must run after the required directive has added its validator
   *       require: ['ngModel', 'select'],
   *       link: function(scope, element, attrs, ctrls) {
   *         var ngModelCtrl = ctrls[0];
   *         var selectCtrl = ctrls[1];
   *
   *         var originalRequiredValidator = ngModelCtrl.$validators.required;
   *
   *         ngModelCtrl.$validators.required = function() {
   *           if (attrs.required && selectCtrl.$isUnknownOptionSelected()) {
   *             return false;
   *           }
   *
   *           return originalRequiredValidator.apply(this, arguments);
   *         };
   *       }
   *     };
   *   });
   * </file>
   * <file name="protractor.js" type="protractor">
   *  it('should show the error message when the unknown option is selected', function() {
  
        var error = element(by.className('error'));
  
        expect(error.getText()).toBe('Error: Please select a value');
  
        element(by.cssContainingText('option', 'Option 1')).click();
  
        expect(error.isPresent()).toBe(false);
  
        element(by.tagName('button')).click();
  
        expect(error.getText()).toBe('Error: Please select a value');
      });
   * </file>
   *</example>
   *
   *
   */
  var SelectController =
          ['$element', '$scope', /** @this */ function($element, $scope) {
  
    var self = this,
        optionsMap = new NgMap();
  
    self.selectValueMap = {}; // Keys are the hashed values, values the original values
  
    // If the ngModel doesn't get provided then provide a dummy noop version to prevent errors
    self.ngModelCtrl = noopNgModelController;
    self.multiple = false;
  
    // The "unknown" option is one that is prepended to the list if the viewValue
    // does not match any of the options. When it is rendered the value of the unknown
    // option is '? XXX ?' where XXX is the hashKey of the value that is not known.
    //
    // Support: IE 9 only
    // We can't just jqLite('<option>') since jqLite is not smart enough
    // to create it in <select> and IE barfs otherwise.
    self.unknownOption = jqLite(window.document.createElement('option'));
  
    // The empty option is an option with the value '' that the application developer can
    // provide inside the select. It is always selectable and indicates that a "null" selection has
    // been made by the user.
    // If the select has an empty option, and the model of the select is set to "undefined" or "null",
    // the empty option is selected.
    // If the model is set to a different unmatched value, the unknown option is rendered and
    // selected, i.e both are present, because a "null" selection and an unknown value are different.
    self.hasEmptyOption = false;
    self.emptyOption = undefined;
  
    self.renderUnknownOption = function(val) {
      var unknownVal = self.generateUnknownOptionValue(val);
      self.unknownOption.val(unknownVal);
      $element.prepend(self.unknownOption);
      setOptionSelectedStatus(self.unknownOption, true);
      $element.val(unknownVal);
    };
  
    self.updateUnknownOption = function(val) {
      var unknownVal = self.generateUnknownOptionValue(val);
      self.unknownOption.val(unknownVal);
      setOptionSelectedStatus(self.unknownOption, true);
      $element.val(unknownVal);
    };
  
    self.generateUnknownOptionValue = function(val) {
      return '? ' + hashKey(val) + ' ?';
    };
  
    self.removeUnknownOption = function() {
      if (self.unknownOption.parent()) self.unknownOption.remove();
    };
  
    self.selectEmptyOption = function() {
      if (self.emptyOption) {
        $element.val('');
        setOptionSelectedStatus(self.emptyOption, true);
      }
    };
  
    self.unselectEmptyOption = function() {
      if (self.hasEmptyOption) {
        setOptionSelectedStatus(self.emptyOption, false);
      }
    };
  
    $scope.$on('$destroy', function() {
      // disable unknown option so that we don't do work when the whole select is being destroyed
      self.renderUnknownOption = noop;
    });
  
    // Read the value of the select control, the implementation of this changes depending
    // upon whether the select can have multiple values and whether ngOptions is at work.
    self.readValue = function readSingleValue() {
      var val = $element.val();
      // ngValue added option values are stored in the selectValueMap, normal interpolations are not
      var realVal = val in self.selectValueMap ? self.selectValueMap[val] : val;
  
      if (self.hasOption(realVal)) {
        return realVal;
      }
  
      return null;
    };
  
  
    // Write the value to the select control, the implementation of this changes depending
    // upon whether the select can have multiple values and whether ngOptions is at work.
    self.writeValue = function writeSingleValue(value) {
      // Make sure to remove the selected attribute from the previously selected option
      // Otherwise, screen readers might get confused
      var currentlySelectedOption = $element[0].options[$element[0].selectedIndex];
      if (currentlySelectedOption) setOptionSelectedStatus(jqLite(currentlySelectedOption), false);
  
      if (self.hasOption(value)) {
        self.removeUnknownOption();
  
        var hashedVal = hashKey(value);
        $element.val(hashedVal in self.selectValueMap ? hashedVal : value);
  
        // Set selected attribute and property on selected option for screen readers
        var selectedOption = $element[0].options[$element[0].selectedIndex];
        setOptionSelectedStatus(jqLite(selectedOption), true);
      } else {
        self.selectUnknownOrEmptyOption(value);
      }
    };
  
  
    // Tell the select control that an option, with the given value, has been added
    self.addOption = function(value, element) {
      // Skip comment nodes, as they only pollute the `optionsMap`
      if (element[0].nodeType === NODE_TYPE_COMMENT) return;
  
      assertNotHasOwnProperty(value, '"option value"');
      if (value === '') {
        self.hasEmptyOption = true;
        self.emptyOption = element;
      }
      var count = optionsMap.get(value) || 0;
      optionsMap.set(value, count + 1);
      // Only render at the end of a digest. This improves render performance when many options
      // are added during a digest and ensures all relevant options are correctly marked as selected
      scheduleRender();
    };
  
    // Tell the select control that an option, with the given value, has been removed
    self.removeOption = function(value) {
      var count = optionsMap.get(value);
      if (count) {
        if (count === 1) {
          optionsMap.delete(value);
          if (value === '') {
            self.hasEmptyOption = false;
            self.emptyOption = undefined;
          }
        } else {
          optionsMap.set(value, count - 1);
        }
      }
    };
  
    // Check whether the select control has an option matching the given value
    self.hasOption = function(value) {
      return !!optionsMap.get(value);
    };
  
    /**
     * @ngdoc method
     * @name select.SelectController#$hasEmptyOption
     *
     * @description
     *
     * Returns `true` if the select element currently has an empty option
     * element, i.e. an option that signifies that the select is empty / the selection is null.
     *
     */
    self.$hasEmptyOption = function() {
      return self.hasEmptyOption;
    };
  
    /**
     * @ngdoc method
     * @name select.SelectController#$isUnknownOptionSelected
     *
     * @description
     *
     * Returns `true` if the select element's unknown option is selected. The unknown option is added
     * and automatically selected whenever the select model doesn't match any option.
     *
     */
    self.$isUnknownOptionSelected = function() {
      // Presence of the unknown option means it is selected
      return $element[0].options[0] === self.unknownOption[0];
    };
  
    /**
     * @ngdoc method
     * @name select.SelectController#$isEmptyOptionSelected
     *
     * @description
     *
     * Returns `true` if the select element has an empty option and this empty option is currently
     * selected. Returns `false` if the select element has no empty option or it is not selected.
     *
     */
    self.$isEmptyOptionSelected = function() {
      return self.hasEmptyOption && $element[0].options[$element[0].selectedIndex] === self.emptyOption[0];
    };
  
    self.selectUnknownOrEmptyOption = function(value) {
      if (value == null && self.emptyOption) {
        self.removeUnknownOption();
        self.selectEmptyOption();
      } else if (self.unknownOption.parent().length) {
        self.updateUnknownOption(value);
      } else {
        self.renderUnknownOption(value);
      }
    };
  
    var renderScheduled = false;
    function scheduleRender() {
      if (renderScheduled) return;
      renderScheduled = true;
      $scope.$$postDigest(function() {
        renderScheduled = false;
        self.ngModelCtrl.$render();
      });
    }
  
    var updateScheduled = false;
    function scheduleViewValueUpdate(renderAfter) {
      if (updateScheduled) return;
  
      updateScheduled = true;
  
      $scope.$$postDigest(function() {
        if ($scope.$$destroyed) return;
  
        updateScheduled = false;
        self.ngModelCtrl.$setViewValue(self.readValue());
        if (renderAfter) self.ngModelCtrl.$render();
      });
    }
  
  
    self.registerOption = function(optionScope, optionElement, optionAttrs, interpolateValueFn, interpolateTextFn) {
  
      if (optionAttrs.$attr.ngValue) {
        // The value attribute is set by ngValue
        var oldVal, hashedVal = NaN;
        optionAttrs.$observe('value', function valueAttributeObserveAction(newVal) {
  
          var removal;
          var previouslySelected = optionElement.prop('selected');
  
          if (isDefined(hashedVal)) {
            self.removeOption(oldVal);
            delete self.selectValueMap[hashedVal];
            removal = true;
          }
  
          hashedVal = hashKey(newVal);
          oldVal = newVal;
          self.selectValueMap[hashedVal] = newVal;
          self.addOption(newVal, optionElement);
          // Set the attribute directly instead of using optionAttrs.$set - this stops the observer
          // from firing a second time. Other $observers on value will also get the result of the
          // ngValue expression, not the hashed value
          optionElement.attr('value', hashedVal);
  
          if (removal && previouslySelected) {
            scheduleViewValueUpdate();
          }
  
        });
      } else if (interpolateValueFn) {
        // The value attribute is interpolated
        optionAttrs.$observe('value', function valueAttributeObserveAction(newVal) {
          // This method is overwritten in ngOptions and has side-effects!
          self.readValue();
  
          var removal;
          var previouslySelected = optionElement.prop('selected');
  
          if (isDefined(oldVal)) {
            self.removeOption(oldVal);
            removal = true;
          }
          oldVal = newVal;
          self.addOption(newVal, optionElement);
  
          if (removal && previouslySelected) {
            scheduleViewValueUpdate();
          }
        });
      } else if (interpolateTextFn) {
        // The text content is interpolated
        optionScope.$watch(interpolateTextFn, function interpolateWatchAction(newVal, oldVal) {
          optionAttrs.$set('value', newVal);
          var previouslySelected = optionElement.prop('selected');
          if (oldVal !== newVal) {
            self.removeOption(oldVal);
          }
          self.addOption(newVal, optionElement);
  
          if (oldVal && previouslySelected) {
            scheduleViewValueUpdate();
          }
        });
      } else {
        // The value attribute is static
        self.addOption(optionAttrs.value, optionElement);
      }
  
  
      optionAttrs.$observe('disabled', function(newVal) {
  
        // Since model updates will also select disabled options (like ngOptions),
        // we only have to handle options becoming disabled, not enabled
  
        if (newVal === 'true' || newVal && optionElement.prop('selected')) {
          if (self.multiple) {
            scheduleViewValueUpdate(true);
          } else {
            self.ngModelCtrl.$setViewValue(null);
            self.ngModelCtrl.$render();
          }
        }
      });
  
      optionElement.on('$destroy', function() {
        var currentValue = self.readValue();
        var removeValue = optionAttrs.value;
  
        self.removeOption(removeValue);
        scheduleRender();
  
        if (self.multiple && currentValue && currentValue.indexOf(removeValue) !== -1 ||
            currentValue === removeValue
        ) {
          // When multiple (selected) options are destroyed at the same time, we don't want
          // to run a model update for each of them. Instead, run a single update in the $$postDigest
          scheduleViewValueUpdate(true);
        }
      });
    };
  }];
  
  /**
   * @ngdoc directive
   * @name select
   * @restrict E
   *
   * @description
   * HTML `select` element with AngularJS data-binding.
   *
   * The `select` directive is used together with {@link ngModel `ngModel`} to provide data-binding
   * between the scope and the `<select>` control (including setting default values).
   * It also handles dynamic `<option>` elements, which can be added using the {@link ngRepeat `ngRepeat}` or
   * {@link ngOptions `ngOptions`} directives.
   *
   * When an item in the `<select>` menu is selected, the value of the selected option will be bound
   * to the model identified by the `ngModel` directive. With static or repeated options, this is
   * the content of the `value` attribute or the textContent of the `<option>`, if the value attribute is missing.
   * Value and textContent can be interpolated.
   *
   * The {@link select.SelectController select controller} exposes utility functions that can be used
   * to manipulate the select's behavior.
   *
   * ## Matching model and option values
   *
   * In general, the match between the model and an option is evaluated by strictly comparing the model
   * value against the value of the available options.
   *
   * If you are setting the option value with the option's `value` attribute, or textContent, the
   * value will always be a `string` which means that the model value must also be a string.
   * Otherwise the `select` directive cannot match them correctly.
   *
   * To bind the model to a non-string value, you can use one of the following strategies:
   * - the {@link ng.ngOptions `ngOptions`} directive
   *   ({@link ng.select#using-select-with-ngoptions-and-setting-a-default-value})
   * - the {@link ng.ngValue `ngValue`} directive, which allows arbitrary expressions to be
   *   option values ({@link ng.select#using-ngvalue-to-bind-the-model-to-an-array-of-objects Example})
   * - model $parsers / $formatters to convert the string value
   *   ({@link ng.select#binding-select-to-a-non-string-value-via-ngmodel-parsing-formatting Example})
   *
   * If the viewValue of `ngModel` does not match any of the options, then the control
   * will automatically add an "unknown" option, which it then removes when the mismatch is resolved.
   *
   * Optionally, a single hard-coded `<option>` element, with the value set to an empty string, can
   * be nested into the `<select>` element. This element will then represent the `null` or "not selected"
   * option. See example below for demonstration.
   *
   * ## Choosing between `ngRepeat` and `ngOptions`
   *
   * In many cases, `ngRepeat` can be used on `<option>` elements instead of {@link ng.directive:ngOptions
   * ngOptions} to achieve a similar result. However, `ngOptions` provides some benefits:
   * - more flexibility in how the `<select>`'s model is assigned via the `select` **`as`** part of the
   * comprehension expression
   * - reduced memory consumption by not creating a new scope for each repeated instance
   * - increased render speed by creating the options in a documentFragment instead of individually
   *
   * Specifically, select with repeated options slows down significantly starting at 2000 options in
   * Chrome and Internet Explorer / Edge.
   *
   *
   * @param {string} ngModel Assignable AngularJS expression to data-bind to.
   * @param {string=} name Property name of the form under which the control is published.
   * @param {string=} multiple Allows multiple options to be selected. The selected values will be
   *     bound to the model as an array.
   * @param {string=} required Sets `required` validation error key if the value is not entered.
   * @param {string=} ngRequired Adds required attribute and required validation constraint to
   * the element when the ngRequired expression evaluates to true. Use ngRequired instead of required
   * when you want to data-bind to the required attribute.
   * @param {string=} ngChange AngularJS expression to be executed when selected option(s) changes due to user
   *    interaction with the select element.
   * @param {string=} ngOptions sets the options that the select is populated with and defines what is
   * set on the model on selection. See {@link ngOptions `ngOptions`}.
   * @param {string=} ngAttrSize sets the size of the select element dynamically. Uses the
   * {@link guide/interpolation#-ngattr-for-binding-to-arbitrary-attributes ngAttr} directive.
   *
   *
   * @knownIssue
   *
   * In Firefox, the select model is only updated when the select element is blurred. For example,
   * when switching between options with the keyboard, the select model is only set to the
   * currently selected option when the select is blurred, e.g via tab key or clicking the mouse
   * outside the select.
   *
   * This is due to an ambiguity in the select element specification. See the
   * [issue on the Firefox bug tracker](https://bugzilla.mozilla.org/show_bug.cgi?id=126379)
   * for more information, and this
   * [Github comment for a workaround](https://github.com/angular/angular.js/issues/9134#issuecomment-130800488)
   *
   * @example
   * ### Simple `select` elements with static options
   *
   * <example name="static-select" module="staticSelect">
   * <file name="index.html">
   * <div ng-controller="ExampleController">
   *   <form name="myForm">
   *     <label for="singleSelect"> Single select: </label><br>
   *     <select name="singleSelect" ng-model="data.singleSelect">
   *       <option value="option-1">Option 1</option>
   *       <option value="option-2">Option 2</option>
   *     </select><br>
   *
   *     <label for="singleSelect"> Single select with "not selected" option and dynamic option values: </label><br>
   *     <select name="singleSelect" id="singleSelect" ng-model="data.singleSelect">
   *       <option value="">---Please select---</option> <!-- not selected / blank option -->
   *       <option value="{{data.option1}}">Option 1</option> <!-- interpolation -->
   *       <option value="option-2">Option 2</option>
   *     </select><br>
   *     <button ng-click="forceUnknownOption()">Force unknown option</button><br>
   *     <tt>singleSelect = {{data.singleSelect}}</tt>
   *
   *     <hr>
   *     <label for="multipleSelect"> Multiple select: </label><br>
   *     <select name="multipleSelect" id="multipleSelect" ng-model="data.multipleSelect" multiple>
   *       <option value="option-1">Option 1</option>
   *       <option value="option-2">Option 2</option>
   *       <option value="option-3">Option 3</option>
   *     </select><br>
   *     <tt>multipleSelect = {{data.multipleSelect}}</tt><br/>
   *   </form>
   * </div>
   * </file>
   * <file name="app.js">
   *  angular.module('staticSelect', [])
   *    .controller('ExampleController', ['$scope', function($scope) {
   *      $scope.data = {
   *       singleSelect: null,
   *       multipleSelect: [],
   *       option1: 'option-1'
   *      };
   *
   *      $scope.forceUnknownOption = function() {
   *        $scope.data.singleSelect = 'nonsense';
   *      };
   *   }]);
   * </file>
   *</example>
   *
   * @example
   * ### Using `ngRepeat` to generate `select` options
   * <example name="select-ngrepeat" module="ngrepeatSelect">
   * <file name="index.html">
   * <div ng-controller="ExampleController">
   *   <form name="myForm">
   *     <label for="repeatSelect"> Repeat select: </label>
   *     <select name="repeatSelect" id="repeatSelect" ng-model="data.model">
   *       <option ng-repeat="option in data.availableOptions" value="{{option.id}}">{{option.name}}</option>
   *     </select>
   *   </form>
   *   <hr>
   *   <tt>model = {{data.model}}</tt><br/>
   * </div>
   * </file>
   * <file name="app.js">
   *  angular.module('ngrepeatSelect', [])
   *    .controller('ExampleController', ['$scope', function($scope) {
   *      $scope.data = {
   *       model: null,
   *       availableOptions: [
   *         {id: '1', name: 'Option A'},
   *         {id: '2', name: 'Option B'},
   *         {id: '3', name: 'Option C'}
   *       ]
   *      };
   *   }]);
   * </file>
   *</example>
   *
   * @example
   * ### Using `ngValue` to bind the model to an array of objects
   * <example name="select-ngvalue" module="ngvalueSelect">
   * <file name="index.html">
   * <div ng-controller="ExampleController">
   *   <form name="myForm">
   *     <label for="ngvalueselect"> ngvalue select: </label>
   *     <select size="6" name="ngvalueselect" ng-model="data.model" multiple>
   *       <option ng-repeat="option in data.availableOptions" ng-value="option.value">{{option.name}}</option>
   *     </select>
   *   </form>
   *   <hr>
   *   <pre>model = {{data.model | json}}</pre><br/>
   * </div>
   * </file>
   * <file name="app.js">
   *  angular.module('ngvalueSelect', [])
   *    .controller('ExampleController', ['$scope', function($scope) {
   *      $scope.data = {
   *       model: null,
   *       availableOptions: [
             {value: 'myString', name: 'string'},
             {value: 1, name: 'integer'},
             {value: true, name: 'boolean'},
             {value: null, name: 'null'},
             {value: {prop: 'value'}, name: 'object'},
             {value: ['a'], name: 'array'}
   *       ]
   *      };
   *   }]);
   * </file>
   *</example>
   *
   * @example
   * ### Using `select` with `ngOptions` and setting a default value
   * See the {@link ngOptions ngOptions documentation} for more `ngOptions` usage examples.
   *
   * <example name="select-with-default-values" module="defaultValueSelect">
   * <file name="index.html">
   * <div ng-controller="ExampleController">
   *   <form name="myForm">
   *     <label for="mySelect">Make a choice:</label>
   *     <select name="mySelect" id="mySelect"
   *       ng-options="option.name for option in data.availableOptions track by option.id"
   *       ng-model="data.selectedOption"></select>
   *   </form>
   *   <hr>
   *   <tt>option = {{data.selectedOption}}</tt><br/>
   * </div>
   * </file>
   * <file name="app.js">
   *  angular.module('defaultValueSelect', [])
   *    .controller('ExampleController', ['$scope', function($scope) {
   *      $scope.data = {
   *       availableOptions: [
   *         {id: '1', name: 'Option A'},
   *         {id: '2', name: 'Option B'},
   *         {id: '3', name: 'Option C'}
   *       ],
   *       selectedOption: {id: '3', name: 'Option C'} //This sets the default value of the select in the ui
   *       };
   *   }]);
   * </file>
   *</example>
   *
   * @example
   * ### Binding `select` to a non-string value via `ngModel` parsing / formatting
   *
   * <example name="select-with-non-string-options" module="nonStringSelect">
   *   <file name="index.html">
   *     <select ng-model="model.id" convert-to-number>
   *       <option value="0">Zero</option>
   *       <option value="1">One</option>
   *       <option value="2">Two</option>
   *     </select>
   *     {{ model }}
   *   </file>
   *   <file name="app.js">
   *     angular.module('nonStringSelect', [])
   *       .run(function($rootScope) {
   *         $rootScope.model = { id: 2 };
   *       })
   *       .directive('convertToNumber', function() {
   *         return {
   *           require: 'ngModel',
   *           link: function(scope, element, attrs, ngModel) {
   *             ngModel.$parsers.push(function(val) {
   *               return parseInt(val, 10);
   *             });
   *             ngModel.$formatters.push(function(val) {
   *               return '' + val;
   *             });
   *           }
   *         };
   *       });
   *   </file>
   *   <file name="protractor.js" type="protractor">
   *     it('should initialize to model', function() {
   *       expect(element(by.model('model.id')).$('option:checked').getText()).toEqual('Two');
   *     });
   *   </file>
   * </example>
   *
   */
  var selectDirective = function() {
  
    return {
      restrict: 'E',
      require: ['select', '?ngModel'],
      controller: SelectController,
      priority: 1,
      link: {
        pre: selectPreLink,
        post: selectPostLink
      }
    };
  
    function selectPreLink(scope, element, attr, ctrls) {
  
        var selectCtrl = ctrls[0];
        var ngModelCtrl = ctrls[1];
  
        // if ngModel is not defined, we don't need to do anything but set the registerOption
        // function to noop, so options don't get added internally
        if (!ngModelCtrl) {
          selectCtrl.registerOption = noop;
          return;
        }
  
  
        selectCtrl.ngModelCtrl = ngModelCtrl;
  
        // When the selected item(s) changes we delegate getting the value of the select control
        // to the `readValue` method, which can be changed if the select can have multiple
        // selected values or if the options are being generated by `ngOptions`
        element.on('change', function() {
          selectCtrl.removeUnknownOption();
          scope.$apply(function() {
            ngModelCtrl.$setViewValue(selectCtrl.readValue());
          });
        });
  
        // If the select allows multiple values then we need to modify how we read and write
        // values from and to the control; also what it means for the value to be empty and
        // we have to add an extra watch since ngModel doesn't work well with arrays - it
        // doesn't trigger rendering if only an item in the array changes.
        if (attr.multiple) {
          selectCtrl.multiple = true;
  
          // Read value now needs to check each option to see if it is selected
          selectCtrl.readValue = function readMultipleValue() {
            var array = [];
            forEach(element.find('option'), function(option) {
              if (option.selected && !option.disabled) {
                var val = option.value;
                array.push(val in selectCtrl.selectValueMap ? selectCtrl.selectValueMap[val] : val);
              }
            });
            return array;
          };
  
          // Write value now needs to set the selected property of each matching option
          selectCtrl.writeValue = function writeMultipleValue(value) {
            forEach(element.find('option'), function(option) {
              var shouldBeSelected = !!value && (includes(value, option.value) ||
                                                 includes(value, selectCtrl.selectValueMap[option.value]));
              var currentlySelected = option.selected;
  
              // Support: IE 9-11 only, Edge 12-15+
              // In IE and Edge adding options to the selection via shift+click/UP/DOWN
              // will de-select already selected options if "selected" on those options was set
              // more than once (i.e. when the options were already selected)
              // So we only modify the selected property if necessary.
              // Note: this behavior cannot be replicated via unit tests because it only shows in the
              // actual user interface.
              if (shouldBeSelected !== currentlySelected) {
                setOptionSelectedStatus(jqLite(option), shouldBeSelected);
              }
  
            });
          };
  
          // we have to do it on each watch since ngModel watches reference, but
          // we need to work of an array, so we need to see if anything was inserted/removed
          var lastView, lastViewRef = NaN;
          scope.$watch(function selectMultipleWatch() {
            if (lastViewRef === ngModelCtrl.$viewValue && !equals(lastView, ngModelCtrl.$viewValue)) {
              lastView = shallowCopy(ngModelCtrl.$viewValue);
              ngModelCtrl.$render();
            }
            lastViewRef = ngModelCtrl.$viewValue;
          });
  
          // If we are a multiple select then value is now a collection
          // so the meaning of $isEmpty changes
          ngModelCtrl.$isEmpty = function(value) {
            return !value || value.length === 0;
          };
  
        }
      }
  
      function selectPostLink(scope, element, attrs, ctrls) {
        // if ngModel is not defined, we don't need to do anything
        var ngModelCtrl = ctrls[1];
        if (!ngModelCtrl) return;
  
        var selectCtrl = ctrls[0];
  
        // We delegate rendering to the `writeValue` method, which can be changed
        // if the select can have multiple selected values or if the options are being
        // generated by `ngOptions`.
        // This must be done in the postLink fn to prevent $render to be called before
        // all nodes have been linked correctly.
        ngModelCtrl.$render = function() {
          selectCtrl.writeValue(ngModelCtrl.$viewValue);
        };
      }
  };
  
  
  // The option directive is purely designed to communicate the existence (or lack of)
  // of dynamically created (and destroyed) option elements to their containing select
  // directive via its controller.
  var optionDirective = ['$interpolate', function($interpolate) {
    return {
      restrict: 'E',
      priority: 100,
      compile: function(element, attr) {
        var interpolateValueFn, interpolateTextFn;
  
        if (isDefined(attr.ngValue)) {
          // Will be handled by registerOption
        } else if (isDefined(attr.value)) {
          // If the value attribute is defined, check if it contains an interpolation
          interpolateValueFn = $interpolate(attr.value, true);
        } else {
          // If the value attribute is not defined then we fall back to the
          // text content of the option element, which may be interpolated
          interpolateTextFn = $interpolate(element.text(), true);
          if (!interpolateTextFn) {
            attr.$set('value', element.text());
          }
        }
  
        return function(scope, element, attr) {
          // This is an optimization over using ^^ since we don't want to have to search
          // all the way to the root of the DOM for every single option element
          var selectCtrlName = '$selectController',
              parent = element.parent(),
              selectCtrl = parent.data(selectCtrlName) ||
                parent.parent().data(selectCtrlName); // in case we are in optgroup
  
          if (selectCtrl) {
            selectCtrl.registerOption(scope, element, attr, interpolateValueFn, interpolateTextFn);
          }
        };
      }
    };
  }];
  
  /**
   * @ngdoc directive
   * @name ngRequired
   * @restrict A
   *
   * @param {expression} ngRequired AngularJS expression. If it evaluates to `true`, it sets the
   *                                `required` attribute to the element and adds the `required`
   *                                {@link ngModel.NgModelController#$validators `validator`}.
   *
   * @description
   *
   * ngRequired adds the required {@link ngModel.NgModelController#$validators `validator`} to {@link ngModel `ngModel`}.
   * It is most often used for {@link input `input`} and {@link select `select`} controls, but can also be
   * applied to custom controls.
   *
   * The directive sets the `required` attribute on the element if the AngularJS expression inside
   * `ngRequired` evaluates to true. A special directive for setting `required` is necessary because we
   * cannot use interpolation inside `required`. See the {@link guide/interpolation interpolation guide}
   * for more info.
   *
   * The validator will set the `required` error key to true if the `required` attribute is set and
   * calling {@link ngModel.NgModelController#$isEmpty `NgModelController.$isEmpty`} with the
   * {@link ngModel.NgModelController#$viewValue `ngModel.$viewValue`} returns `true`. For example, the
   * `$isEmpty()` implementation for `input[text]` checks the length of the `$viewValue`. When developing
   * custom controls, `$isEmpty()` can be overwritten to account for a $viewValue that is not string-based.
   *
   * @example
   * <example name="ngRequiredDirective" module="ngRequiredExample">
   *   <file name="index.html">
   *     <script>
   *       angular.module('ngRequiredExample', [])
   *         .controller('ExampleController', ['$scope', function($scope) {
   *           $scope.required = true;
   *         }]);
   *     </script>
   *     <div ng-controller="ExampleController">
   *       <form name="form">
   *         <label for="required">Toggle required: </label>
   *         <input type="checkbox" ng-model="required" id="required" />
   *         <br>
   *         <label for="input">This input must be filled if `required` is true: </label>
   *         <input type="text" ng-model="model" id="input" name="input" ng-required="required" /><br>
   *         <hr>
   *         required error set? = <code>{{form.input.$error.required}}</code><br>
   *         model = <code>{{model}}</code>
   *       </form>
   *     </div>
   *   </file>
   *   <file name="protractor.js" type="protractor">
         var required = element(by.binding('form.input.$error.required'));
         var model = element(by.binding('model'));
         var input = element(by.id('input'));
  
         it('should set the required error', function() {
           expect(required.getText()).toContain('true');
  
           input.sendKeys('123');
           expect(required.getText()).not.toContain('true');
           expect(model.getText()).toContain('123');
         });
   *   </file>
   * </example>
   */
  var requiredDirective = function() {
    return {
      restrict: 'A',
      require: '?ngModel',
      link: function(scope, elm, attr, ctrl) {
        if (!ctrl) return;
        attr.required = true; // force truthy in case we are on non input element
  
        ctrl.$validators.required = function(modelValue, viewValue) {
          return !attr.required || !ctrl.$isEmpty(viewValue);
        };
  
        attr.$observe('required', function() {
          ctrl.$validate();
        });
      }
    };
  };
  
  /**
   * @ngdoc directive
   * @name ngPattern
   * @restrict A
   *
   * @param {expression|RegExp} ngPattern AngularJS expression that must evaluate to a `RegExp` or a `String`
   *                                      parsable into a `RegExp`, or a `RegExp` literal. See above for
   *                                      more details.
   *
   * @description
   *
   * ngPattern adds the pattern {@link ngModel.NgModelController#$validators `validator`} to {@link ngModel `ngModel`}.
   * It is most often used for text-based {@link input `input`} controls, but can also be applied to custom text-based controls.
   *
   * The validator sets the `pattern` error key if the {@link ngModel.NgModelController#$viewValue `ngModel.$viewValue`}
   * does not match a RegExp which is obtained from the `ngPattern` attribute value:
   * - the value is an AngularJS expression:
   *   - If the expression evaluates to a RegExp object, then this is used directly.
   *   - If the expression evaluates to a string, then it will be converted to a RegExp after wrapping it
   *     in `^` and `$` characters. For instance, `"abc"` will be converted to `new RegExp('^abc$')`.
   * - If the value is a RegExp literal, e.g. `ngPattern="/^\d+$/"`, it is used directly.
   *
   * <div class="alert alert-info">
   * **Note:** Avoid using the `g` flag on the RegExp, as it will cause each successive search to
   * start at the index of the last search's match, thus not taking the whole input value into
   * account.
   * </div>
   *
   * <div class="alert alert-info">
   * **Note:** This directive is also added when the plain `pattern` attribute is used, with two
   * differences:
   * <ol>
   *   <li>
   *     `ngPattern` does not set the `pattern` attribute and therefore HTML5 constraint validation is
   *     not available.
   *   </li>
   *   <li>
   *     The `ngPattern` attribute must be an expression, while the `pattern` value must be
   *     interpolated.
   *   </li>
   * </ol>
   * </div>
   *
   * @example
   * <example name="ngPatternDirective" module="ngPatternExample">
   *   <file name="index.html">
   *     <script>
   *       angular.module('ngPatternExample', [])
   *         .controller('ExampleController', ['$scope', function($scope) {
   *           $scope.regex = '\\d+';
   *         }]);
   *     </script>
   *     <div ng-controller="ExampleController">
   *       <form name="form">
   *         <label for="regex">Set a pattern (regex string): </label>
   *         <input type="text" ng-model="regex" id="regex" />
   *         <br>
   *         <label for="input">This input is restricted by the current pattern: </label>
   *         <input type="text" ng-model="model" id="input" name="input" ng-pattern="regex" /><br>
   *         <hr>
   *         input valid? = <code>{{form.input.$valid}}</code><br>
   *         model = <code>{{model}}</code>
   *       </form>
   *     </div>
   *   </file>
   *   <file name="protractor.js" type="protractor">
         var model = element(by.binding('model'));
         var input = element(by.id('input'));
  
         it('should validate the input with the default pattern', function() {
           input.sendKeys('aaa');
           expect(model.getText()).not.toContain('aaa');
  
           input.clear().then(function() {
             input.sendKeys('123');
             expect(model.getText()).toContain('123');
           });
         });
   *   </file>
   * </example>
   */
  var patternDirective = function() {
    return {
      restrict: 'A',
      require: '?ngModel',
      link: function(scope, elm, attr, ctrl) {
        if (!ctrl) return;
  
        var regexp, patternExp = attr.ngPattern || attr.pattern;
        attr.$observe('pattern', function(regex) {
          if (isString(regex) && regex.length > 0) {
            regex = new RegExp('^' + regex + '$');
          }
  
          if (regex && !regex.test) {
            throw minErr('ngPattern')('noregexp',
              'Expected {0} to be a RegExp but was {1}. Element: {2}', patternExp,
              regex, startingTag(elm));
          }
  
          regexp = regex || undefined;
          ctrl.$validate();
        });
  
        ctrl.$validators.pattern = function(modelValue, viewValue) {
          // HTML5 pattern constraint validates the input value, so we validate the viewValue
          return ctrl.$isEmpty(viewValue) || isUndefined(regexp) || regexp.test(viewValue);
        };
      }
    };
  };
  
  /**
   * @ngdoc directive
   * @name ngMaxlength
   * @restrict A
   *
   * @param {expression} ngMaxlength AngularJS expression that must evaluate to a `Number` or `String`
   *                                 parsable into a `Number`. Used as value for the `maxlength`
   *                                 {@link ngModel.NgModelController#$validators validator}.
   *
   * @description
   *
   * ngMaxlength adds the maxlength {@link ngModel.NgModelController#$validators `validator`} to {@link ngModel `ngModel`}.
   * It is most often used for text-based {@link input `input`} controls, but can also be applied to custom text-based controls.
   *
   * The validator sets the `maxlength` error key if the {@link ngModel.NgModelController#$viewValue `ngModel.$viewValue`}
   * is longer than the integer obtained by evaluating the AngularJS expression given in the
   * `ngMaxlength` attribute value.
   *
   * <div class="alert alert-info">
   * **Note:** This directive is also added when the plain `maxlength` attribute is used, with two
   * differences:
   * <ol>
   *   <li>
   *     `ngMaxlength` does not set the `maxlength` attribute and therefore HTML5 constraint
   *     validation is not available.
   *   </li>
   *   <li>
   *     The `ngMaxlength` attribute must be an expression, while the `maxlength` value must be
   *     interpolated.
   *   </li>
   * </ol>
   * </div>
   *
   * @example
   * <example name="ngMaxlengthDirective" module="ngMaxlengthExample">
   *   <file name="index.html">
   *     <script>
   *       angular.module('ngMaxlengthExample', [])
   *         .controller('ExampleController', ['$scope', function($scope) {
   *           $scope.maxlength = 5;
   *         }]);
   *     </script>
   *     <div ng-controller="ExampleController">
   *       <form name="form">
   *         <label for="maxlength">Set a maxlength: </label>
   *         <input type="number" ng-model="maxlength" id="maxlength" />
   *         <br>
   *         <label for="input">This input is restricted by the current maxlength: </label>
   *         <input type="text" ng-model="model" id="input" name="input" ng-maxlength="maxlength" /><br>
   *         <hr>
   *         input valid? = <code>{{form.input.$valid}}</code><br>
   *         model = <code>{{model}}</code>
   *       </form>
   *     </div>
   *   </file>
   *   <file name="protractor.js" type="protractor">
         var model = element(by.binding('model'));
         var input = element(by.id('input'));
  
         it('should validate the input with the default maxlength', function() {
           input.sendKeys('abcdef');
           expect(model.getText()).not.toContain('abcdef');
  
           input.clear().then(function() {
             input.sendKeys('abcde');
             expect(model.getText()).toContain('abcde');
           });
         });
   *   </file>
   * </example>
   */
  var maxlengthDirective = function() {
    return {
      restrict: 'A',
      require: '?ngModel',
      link: function(scope, elm, attr, ctrl) {
        if (!ctrl) return;
  
        var maxlength = -1;
        attr.$observe('maxlength', function(value) {
          var intVal = toInt(value);
          maxlength = isNumberNaN(intVal) ? -1 : intVal;
          ctrl.$validate();
        });
        ctrl.$validators.maxlength = function(modelValue, viewValue) {
          return (maxlength < 0) || ctrl.$isEmpty(viewValue) || (viewValue.length <= maxlength);
        };
      }
    };
  };
  
  /**
   * @ngdoc directive
   * @name ngMinlength
   * @restrict A
   *
   * @param {expression} ngMinlength AngularJS expression that must evaluate to a `Number` or `String`
   *                                 parsable into a `Number`. Used as value for the `minlength`
   *                                 {@link ngModel.NgModelController#$validators validator}.
   *
   * @description
   *
   * ngMinlength adds the minlength {@link ngModel.NgModelController#$validators `validator`} to {@link ngModel `ngModel`}.
   * It is most often used for text-based {@link input `input`} controls, but can also be applied to custom text-based controls.
   *
   * The validator sets the `minlength` error key if the {@link ngModel.NgModelController#$viewValue `ngModel.$viewValue`}
   * is shorter than the integer obtained by evaluating the AngularJS expression given in the
   * `ngMinlength` attribute value.
   *
   * <div class="alert alert-info">
   * **Note:** This directive is also added when the plain `minlength` attribute is used, with two
   * differences:
   * <ol>
   *   <li>
   *     `ngMinlength` does not set the `minlength` attribute and therefore HTML5 constraint
   *     validation is not available.
   *   </li>
   *   <li>
   *     The `ngMinlength` value must be an expression, while the `minlength` value must be
   *     interpolated.
   *   </li>
   * </ol>
   * </div>
   *
   * @example
   * <example name="ngMinlengthDirective" module="ngMinlengthExample">
   *   <file name="index.html">
   *     <script>
   *       angular.module('ngMinlengthExample', [])
   *         .controller('ExampleController', ['$scope', function($scope) {
   *           $scope.minlength = 3;
   *         }]);
   *     </script>
   *     <div ng-controller="ExampleController">
   *       <form name="form">
   *         <label for="minlength">Set a minlength: </label>
   *         <input type="number" ng-model="minlength" id="minlength" />
   *         <br>
   *         <label for="input">This input is restricted by the current minlength: </label>
   *         <input type="text" ng-model="model" id="input" name="input" ng-minlength="minlength" /><br>
   *         <hr>
   *         input valid? = <code>{{form.input.$valid}}</code><br>
   *         model = <code>{{model}}</code>
   *       </form>
   *     </div>
   *   </file>
   *   <file name="protractor.js" type="protractor">
         var model = element(by.binding('model'));
         var input = element(by.id('input'));
  
         it('should validate the input with the default minlength', function() {
           input.sendKeys('ab');
           expect(model.getText()).not.toContain('ab');
  
           input.sendKeys('abc');
           expect(model.getText()).toContain('abc');
         });
   *   </file>
   * </example>
   */
  var minlengthDirective = function() {
    return {
      restrict: 'A',
      require: '?ngModel',
      link: function(scope, elm, attr, ctrl) {
        if (!ctrl) return;
  
        var minlength = 0;
        attr.$observe('minlength', function(value) {
          minlength = toInt(value) || 0;
          ctrl.$validate();
        });
        ctrl.$validators.minlength = function(modelValue, viewValue) {
          return ctrl.$isEmpty(viewValue) || viewValue.length >= minlength;
        };
      }
    };
  };
  
  if (window.angular.bootstrap) {
    // AngularJS is already loaded, so we can return here...
    if (window.console) {
      console.log('WARNING: Tried to load AngularJS more than once.');
    }
    return;
  }
  
  // try to bind to jquery now so that one can write jqLite(fn)
  // but we will rebind on bootstrap again.
  bindJQuery();
  
  publishExternalAPI(angular);
  
  angular.module("ngLocale", [], ["$provide", function($provide) {
  var PLURAL_CATEGORY = {ZERO: "zero", ONE: "one", TWO: "two", FEW: "few", MANY: "many", OTHER: "other"};
  function getDecimals(n) {
    n = n + '';
    var i = n.indexOf('.');
    return (i == -1) ? 0 : n.length - i - 1;
  }
  
  function getVF(n, opt_precision) {
    var v = opt_precision;
  
    if (undefined === v) {
      v = Math.min(getDecimals(n), 3);
    }
  
    var base = Math.pow(10, v);
    var f = ((n * base) | 0) % base;
    return {v: v, f: f};
  }
  
  $provide.value("$locale", {
    "DATETIME_FORMATS": {
      "AMPMS": [
        "AM",
        "PM"
      ],
      "DAY": [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ],
      "ERANAMES": [
        "Before Christ",
        "Anno Domini"
      ],
      "ERAS": [
        "BC",
        "AD"
      ],
      "FIRSTDAYOFWEEK": 6,
      "MONTH": [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
      ],
      "SHORTDAY": [
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat"
      ],
      "SHORTMONTH": [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ],
      "STANDALONEMONTH": [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
      ],
      "WEEKENDRANGE": [
        5,
        6
      ],
      "fullDate": "EEEE, MMMM d, y",
      "longDate": "MMMM d, y",
      "medium": "MMM d, y h:mm:ss a",
      "mediumDate": "MMM d, y",
      "mediumTime": "h:mm:ss a",
      "short": "M/d/yy h:mm a",
      "shortDate": "M/d/yy",
      "shortTime": "h:mm a"
    },
    "NUMBER_FORMATS": {
      "CURRENCY_SYM": "$",
      "DECIMAL_SEP": ".",
      "GROUP_SEP": ",",
      "PATTERNS": [
        {
          "gSize": 3,
          "lgSize": 3,
          "maxFrac": 3,
          "minFrac": 0,
          "minInt": 1,
          "negPre": "-",
          "negSuf": "",
          "posPre": "",
          "posSuf": ""
        },
        {
          "gSize": 3,
          "lgSize": 3,
          "maxFrac": 2,
          "minFrac": 2,
          "minInt": 1,
          "negPre": "-\u00a4",
          "negSuf": "",
          "posPre": "\u00a4",
          "posSuf": ""
        }
      ]
    },
    "id": "en-us",
    "localeID": "en_US",
    "pluralCat": function(n, opt_precision) {  var i = n | 0;  var vf = getVF(n, opt_precision);  if (i == 1 && vf.v == 0) {    return PLURAL_CATEGORY.ONE;  }  return PLURAL_CATEGORY.OTHER;}
  });
  }]);
  
    jqLite(function() {
      angularInit(window.document, bootstrap);
    });
  
  })(window);
  
  !window.angular.$$csp().noInlineStyle && window.angular.element(document.head).prepend('<style type="text/css">@charset "UTF-8";[ng\\:cloak],[ng-cloak],[data-ng-cloak],[x-ng-cloak],.ng-cloak,.x-ng-cloak,.ng-hide:not(.ng-hide-animate){display:none !important;}ng\\:form{display:block;}.ng-animate-shim{visibility:hidden;}.ng-anchor{position:absolute;}</style>');