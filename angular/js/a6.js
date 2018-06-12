* @example
      <example name="range-input-directive-ng" module="rangeExample">
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
            Model as range: <input type="range" name="range" ng-model="value" ng-min="min" ng-max="max">
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

   */
  'range': rangeInputType,

  /**
   * @ngdoc input
   * @name input[checkbox]
   *
   * @description
   * HTML checkbox.
   *
   * @param {string} ngModel Assignable AngularJS expression to data-bind to.
   * @param {string=} name Property name of the form under which the control is published.
   * @param {expression=} ngTrueValue The value to which the expression should be set when selected.
   * @param {expression=} ngFalseValue The value to which the expression should be set when not selected.
   * @param {string=} ngChange AngularJS expression to be executed when input changes due to user
   *    interaction with the input element.
   *
   * @example
      <example name="checkbox-input-directive" module="checkboxExample">
        <file name="index.html">
         <script>
           angular.module('checkboxExample', [])
             .controller('ExampleController', ['$scope', function($scope) {
               $scope.checkboxModel = {
                value1 : true,
                value2 : 'YES'
              };
             }]);
         </script>
         <form name="myForm" ng-controller="ExampleController">
           <label>Value1:
             <input type="checkbox" ng-model="checkboxModel.value1">
           </label><br/>
           <label>Value2:
             <input type="checkbox" ng-model="checkboxModel.value2"
                    ng-true-value="'YES'" ng-false-value="'NO'">
            </label><br/>
           <tt>value1 = {{checkboxModel.value1}}</tt><br/>
           <tt>value2 = {{checkboxModel.value2}}</tt><br/>
          </form>
        </file>
        <file name="protractor.js" type="protractor">
          it('should change state', function() {
            var value1 = element(by.binding('checkboxModel.value1'));
            var value2 = element(by.binding('checkboxModel.value2'));

            expect(value1.getText()).toContain('true');
            expect(value2.getText()).toContain('YES');

            element(by.model('checkboxModel.value1')).click();
            element(by.model('checkboxModel.value2')).click();

            expect(value1.getText()).toContain('false');
            expect(value2.getText()).toContain('NO');
          });
        </file>
      </example>
   */
  'checkbox': checkboxInputType,

  'hidden': noop,
  'button': noop,
  'submit': noop,
  'reset': noop,
  'file': noop
};

function stringBasedInputType(ctrl) {
  ctrl.$formatters.push(function(value) {
    return ctrl.$isEmpty(value) ? value : value.toString();
  });
}

function textInputType(scope, element, attr, ctrl, $sniffer, $browser) {
  baseInputType(scope, element, attr, ctrl, $sniffer, $browser);
  stringBasedInputType(ctrl);
}

function baseInputType(scope, element, attr, ctrl, $sniffer, $browser) {
  var type = lowercase(element[0].type);

  // In composition mode, users are still inputting intermediate text buffer,
  // hold the listener until composition is done.
  // More about composition events: https://developer.mozilla.org/en-US/docs/Web/API/CompositionEvent
  if (!$sniffer.android) {
    var composing = false;

    element.on('compositionstart', function() {
      composing = true;
    });

    element.on('compositionend', function() {
      composing = false;
      listener();
    });
  }

  var timeout;

  var listener = function(ev) {
    if (timeout) {
      $browser.defer.cancel(timeout);
      timeout = null;
    }
    if (composing) return;
    var value = element.val(),
        event = ev && ev.type;

    // By default we will trim the value
    // If the attribute ng-trim exists we will avoid trimming
    // If input type is 'password', the value is never trimmed
    if (type !== 'password' && (!attr.ngTrim || attr.ngTrim !== 'false')) {
      value = trim(value);
    }

    // If a control is suffering from bad input (due to native validators), browsers discard its
    // value, so it may be necessary to revalidate (by calling $setViewValue again) even if the
    // control's value is the same empty value twice in a row.
    if (ctrl.$viewValue !== value || (value === '' && ctrl.$$hasNativeValidators)) {
      ctrl.$setViewValue(value, event);
    }
  };

  // if the browser does support "input" event, we are fine - except on IE9 which doesn't fire the
  // input event on backspace, delete or cut
  if ($sniffer.hasEvent('input')) {
    element.on('input', listener);
  } else {
    var deferListener = function(ev, input, origValue) {
      if (!timeout) {
        timeout = $browser.defer(function() {
          timeout = null;
          if (!input || input.value !== origValue) {
            listener(ev);
          }
        });
      }
    };

    element.on('keydown', /** @this */ function(event) {
      var key = event.keyCode;

      // ignore
      //    command            modifiers                   arrows
      if (key === 91 || (15 < key && key < 19) || (37 <= key && key <= 40)) return;

      deferListener(event, this, this.value);
    });

    // if user modifies input value using context menu in IE, we need "paste", "cut" and "drop" events to catch it
    if ($sniffer.hasEvent('paste')) {
      element.on('paste cut drop', deferListener);
    }
  }

  // if user paste into input using mouse on older browser
  // or form autocomplete on newer browser, we need "change" event to catch it
  element.on('change', listener);

  // Some native input types (date-family) have the ability to change validity without
  // firing any input/change events.
  // For these event types, when native validators are present and the browser supports the type,
  // check for validity changes on various DOM events.
  if (PARTIAL_VALIDATION_TYPES[type] && ctrl.$$hasNativeValidators && type === attr.type) {
    element.on(PARTIAL_VALIDATION_EVENTS, /** @this */ function(ev) {
      if (!timeout) {
        var validity = this[VALIDITY_STATE_PROPERTY];
        var origBadInput = validity.badInput;
        var origTypeMismatch = validity.typeMismatch;
        timeout = $browser.defer(function() {
          timeout = null;
          if (validity.badInput !== origBadInput || validity.typeMismatch !== origTypeMismatch) {
            listener(ev);
          }
        });
      }
    });
  }

  ctrl.$render = function() {
    // Workaround for Firefox validation #12102.
    var value = ctrl.$isEmpty(ctrl.$viewValue) ? '' : ctrl.$viewValue;
    if (element.val() !== value) {
      element.val(value);
    }
  };
}

function weekParser(isoWeek, existingDate) {
  if (isDate(isoWeek)) {
    return isoWeek;
  }

  if (isString(isoWeek)) {
    WEEK_REGEXP.lastIndex = 0;
    var parts = WEEK_REGEXP.exec(isoWeek);
    if (parts) {
      var year = +parts[1],
          week = +parts[2],
          hours = 0,
          minutes = 0,
          seconds = 0,
          milliseconds = 0,
          firstThurs = getFirstThursdayOfYear(year),
          addDays = (week - 1) * 7;

      if (existingDate) {
        hours = existingDate.getHours();
        minutes = existingDate.getMinutes();
        seconds = existingDate.getSeconds();
        milliseconds = existingDate.getMilliseconds();
      }

      return new Date(year, 0, firstThurs.getDate() + addDays, hours, minutes, seconds, milliseconds);
    }
  }

  return NaN;
}

function createDateParser(regexp, mapping) {
  return function(iso, date) {
    var parts, map;

    if (isDate(iso)) {
      return iso;
    }

    if (isString(iso)) {
      // When a date is JSON'ified to wraps itself inside of an extra
      // set of double quotes. This makes the date parsing code unable
      // to match the date string and parse it as a date.
      if (iso.charAt(0) === '"' && iso.charAt(iso.length - 1) === '"') {
        iso = iso.substring(1, iso.length - 1);
      }
      if (ISO_DATE_REGEXP.test(iso)) {
        return new Date(iso);
      }
      regexp.lastIndex = 0;
      parts = regexp.exec(iso);

      if (parts) {
        parts.shift();
        if (date) {
          map = {
            yyyy: date.getFullYear(),
            MM: date.getMonth() + 1,
            dd: date.getDate(),
            HH: date.getHours(),
            mm: date.getMinutes(),
            ss: date.getSeconds(),
            sss: date.getMilliseconds() / 1000
          };
        } else {
          map = { yyyy: 1970, MM: 1, dd: 1, HH: 0, mm: 0, ss: 0, sss: 0 };
        }

        forEach(parts, function(part, index) {
          if (index < mapping.length) {
            map[mapping[index]] = +part;
          }
        });
        return new Date(map.yyyy, map.MM - 1, map.dd, map.HH, map.mm, map.ss || 0, map.sss * 1000 || 0);
      }
    }

    return NaN;
  };
}

function createDateInputType(type, regexp, parseDate, format) {
  return function dynamicDateInputType(scope, element, attr, ctrl, $sniffer, $browser, $filter) {
    badInputChecker(scope, element, attr, ctrl);
    baseInputType(scope, element, attr, ctrl, $sniffer, $browser);
    var timezone = ctrl && ctrl.$options.getOption('timezone');
    var previousDate;

    ctrl.$$parserName = type;
    ctrl.$parsers.push(function(value) {
      if (ctrl.$isEmpty(value)) return null;
      if (regexp.test(value)) {
        // Note: We cannot read ctrl.$modelValue, as there might be a different
        // parser/formatter in the processing chain so that the model
        // contains some different data format!
        var parsedDate = parseDate(value, previousDate);
        if (timezone) {
          parsedDate = convertTimezoneToLocal(parsedDate, timezone);
        }
        return parsedDate;
      }
      return undefined;
    });

    ctrl.$formatters.push(function(value) {
      if (value && !isDate(value)) {
        throw ngModelMinErr('datefmt', 'Expected `{0}` to be a date', value);
      }
      if (isValidDate(value)) {
        previousDate = value;
        if (previousDate && timezone) {
          previousDate = convertTimezoneToLocal(previousDate, timezone, true);
        }
        return $filter('date')(value, format, timezone);
      } else {
        previousDate = null;
        return '';
      }
    });

    if (isDefined(attr.min) || attr.ngMin) {
      var minVal;
      ctrl.$validators.min = function(value) {
        return !isValidDate(value) || isUndefined(minVal) || parseDate(value) >= minVal;
      };
      attr.$observe('min', function(val) {
        minVal = parseObservedDateValue(val);
        ctrl.$validate();
      });
    }

    if (isDefined(attr.max) || attr.ngMax) {
      var maxVal;
      ctrl.$validators.max = function(value) {
        return !isValidDate(value) || isUndefined(maxVal) || parseDate(value) <= maxVal;
      };
      attr.$observe('max', function(val) {
        maxVal = parseObservedDateValue(val);
        ctrl.$validate();
      });
    }

    function isValidDate(value) {
      // Invalid Date: getTime() returns NaN
      return value && !(value.getTime && value.getTime() !== value.getTime());
    }

    function parseObservedDateValue(val) {
      return isDefined(val) && !isDate(val) ? parseDate(val) || undefined : val;
    }
  };
}

function badInputChecker(scope, element, attr, ctrl) {
  var node = element[0];
  var nativeValidation = ctrl.$$hasNativeValidators = isObject(node.validity);
  if (nativeValidation) {
    ctrl.$parsers.push(function(value) {
      var validity = element.prop(VALIDITY_STATE_PROPERTY) || {};
      return validity.badInput || validity.typeMismatch ? undefined : value;
    });
  }
}

function numberFormatterParser(ctrl) {
  ctrl.$$parserName = 'number';
  ctrl.$parsers.push(function(value) {
    if (ctrl.$isEmpty(value))      return null;
    if (NUMBER_REGEXP.test(value)) return parseFloat(value);
    return undefined;
  });

  ctrl.$formatters.push(function(value) {
    if (!ctrl.$isEmpty(value)) {
      if (!isNumber(value)) {
        throw ngModelMinErr('numfmt', 'Expected `{0}` to be a number', value);
      }
      value = value.toString();
    }
    return value;
  });
}

function parseNumberAttrVal(val) {
  if (isDefined(val) && !isNumber(val)) {
    val = parseFloat(val);
  }
  return !isNumberNaN(val) ? val : undefined;
}

function isNumberInteger(num) {
  // See http://stackoverflow.com/questions/14636536/how-to-check-if-a-variable-is-an-integer-in-javascript#14794066
  // (minus the assumption that `num` is a number)

  // eslint-disable-next-line no-bitwise
  return (num | 0) === num;
}

function countDecimals(num) {
  var numString = num.toString();
  var decimalSymbolIndex = numString.indexOf('.');

  if (decimalSymbolIndex === -1) {
    if (-1 < num && num < 1) {
      // It may be in the exponential notation format (`1e-X`)
      var match = /e-(\d+)$/.exec(numString);

      if (match) {
        return Number(match[1]);
      }
    }

    return 0;
  }

  return numString.length - decimalSymbolIndex - 1;
}

function isValidForStep(viewValue, stepBase, step) {
  // At this point `stepBase` and `step` are expected to be non-NaN values
  // and `viewValue` is expected to be a valid stringified number.
  var value = Number(viewValue);

  var isNonIntegerValue = !isNumberInteger(value);
  var isNonIntegerStepBase = !isNumberInteger(stepBase);
  var isNonIntegerStep = !isNumberInteger(step);

  // Due to limitations in Floating Point Arithmetic (e.g. `0.3 - 0.2 !== 0.1` or
  // `0.5 % 0.1 !== 0`), we need to convert all numbers to integers.
  if (isNonIntegerValue || isNonIntegerStepBase || isNonIntegerStep) {
    var valueDecimals = isNonIntegerValue ? countDecimals(value) : 0;
    var stepBaseDecimals = isNonIntegerStepBase ? countDecimals(stepBase) : 0;
    var stepDecimals = isNonIntegerStep ? countDecimals(step) : 0;

    var decimalCount = Math.max(valueDecimals, stepBaseDecimals, stepDecimals);
    var multiplier = Math.pow(10, decimalCount);

    value = value * multiplier;
    stepBase = stepBase * multiplier;
    step = step * multiplier;

    if (isNonIntegerValue) value = Math.round(value);
    if (isNonIntegerStepBase) stepBase = Math.round(stepBase);
    if (isNonIntegerStep) step = Math.round(step);
  }

  return (value - stepBase) % step === 0;
}

function numberInputType(scope, element, attr, ctrl, $sniffer, $browser) {
  badInputChecker(scope, element, attr, ctrl);
  numberFormatterParser(ctrl);
  baseInputType(scope, element, attr, ctrl, $sniffer, $browser);

  var minVal;
  var maxVal;

  if (isDefined(attr.min) || attr.ngMin) {
    ctrl.$validators.min = function(value) {
      return ctrl.$isEmpty(value) || isUndefined(minVal) || value >= minVal;
    };

    attr.$observe('min', function(val) {
      minVal = parseNumberAttrVal(val);
      // TODO(matsko): implement validateLater to reduce number of validations
      ctrl.$validate();
    });
  }

  if (isDefined(attr.max) || attr.ngMax) {
    ctrl.$validators.max = function(value) {
      return ctrl.$isEmpty(value) || isUndefined(maxVal) || value <= maxVal;
    };

    attr.$observe('max', function(val) {
      maxVal = parseNumberAttrVal(val);
      // TODO(matsko): implement validateLater to reduce number of validations
      ctrl.$validate();
    });
  }

  if (isDefined(attr.step) || attr.ngStep) {
    var stepVal;
    ctrl.$validators.step = function(modelValue, viewValue) {
      return ctrl.$isEmpty(viewValue) || isUndefined(stepVal) ||
             isValidForStep(viewValue, minVal || 0, stepVal);
    };

    attr.$observe('step', function(val) {
      stepVal = parseNumberAttrVal(val);
      // TODO(matsko): implement validateLater to reduce number of validations
      ctrl.$validate();
    });
  }
}

function rangeInputType(scope, element, attr, ctrl, $sniffer, $browser) {
  badInputChecker(scope, element, attr, ctrl);
  numberFormatterParser(ctrl);
  baseInputType(scope, element, attr, ctrl, $sniffer, $browser);

  var supportsRange = ctrl.$$hasNativeValidators && element[0].type === 'range',
      minVal = supportsRange ? 0 : undefined,
      maxVal = supportsRange ? 100 : undefined,
      stepVal = supportsRange ? 1 : undefined,
      validity = element[0].validity,
      hasMinAttr = isDefined(attr.min),
      hasMaxAttr = isDefined(attr.max),
      hasStepAttr = isDefined(attr.step);

  var originalRender = ctrl.$render;

  ctrl.$render = supportsRange && isDefined(validity.rangeUnderflow) && isDefined(validity.rangeOverflow) ?
    //Browsers that implement range will set these values automatically, but reading the adjusted values after
    //$render would cause the min / max validators to be applied with the wrong value
    function rangeRender() {
      originalRender();
      ctrl.$setViewValue(element.val());
    } :
    originalRender;

  if (hasMinAttr) {
    ctrl.$validators.min = supportsRange ?
      // Since all browsers set the input to a valid value, we don't need to check validity
      function noopMinValidator() { return true; } :
      // non-support browsers validate the min val
      function minValidator(modelValue, viewValue) {
        return ctrl.$isEmpty(viewValue) || isUndefined(minVal) || viewValue >= minVal;
      };

    setInitialValueAndObserver('min', minChange);
  }

  if (hasMaxAttr) {
    ctrl.$validators.max = supportsRange ?
      // Since all browsers set the input to a valid value, we don't need to check validity
      function noopMaxValidator() { return true; } :
      // non-support browsers validate the max val
      function maxValidator(modelValue, viewValue) {
        return ctrl.$isEmpty(viewValue) || isUndefined(maxVal) || viewValue <= maxVal;
      };

    setInitialValueAndObserver('max', maxChange);
  }

  if (hasStepAttr) {
    ctrl.$validators.step = supportsRange ?
      function nativeStepValidator() {
        // Currently, only FF implements the spec on step change correctly (i.e. adjusting the
        // input element value to a valid value). It's possible that other browsers set the stepMismatch
        // validity error instead, so we can at least report an error in that case.
        return !validity.stepMismatch;
      } :
      // ngStep doesn't set the setp attr, so the browser doesn't adjust the input value as setting step would
      function stepValidator(modelValue, viewValue) {
        return ctrl.$isEmpty(viewValue) || isUndefined(stepVal) ||
               isValidForStep(viewValue, minVal || 0, stepVal);
      };

    setInitialValueAndObserver('step', stepChange);
  }

  function setInitialValueAndObserver(htmlAttrName, changeFn) {
    // interpolated attributes set the attribute value only after a digest, but we need the
    // attribute value when the input is first rendered, so that the browser can adjust the
    // input value based on the min/max value
    element.attr(htmlAttrName, attr[htmlAttrName]);
    attr.$observe(htmlAttrName, changeFn);
  }

  function minChange(val) {
    minVal = parseNumberAttrVal(val);
    // ignore changes before model is initialized
    if (isNumberNaN(ctrl.$modelValue)) {
      return;
    }

    if (supportsRange) {
      var elVal = element.val();
      // IE11 doesn't set the el val correctly if the minVal is greater than the element value
      if (minVal > elVal) {
        elVal = minVal;
        element.val(elVal);
      }
      ctrl.$setViewValue(elVal);
    } else {
      // TODO(matsko): implement validateLater to reduce number of validations
      ctrl.$validate();
    }
  }

  function maxChange(val) {
    maxVal = parseNumberAttrVal(val);
    // ignore changes before model is initialized
    if (isNumberNaN(ctrl.$modelValue)) {
      return;
    }

    if (supportsRange) {
      var elVal = element.val();
      // IE11 doesn't set the el val correctly if the maxVal is less than the element value
      if (maxVal < elVal) {
        element.val(maxVal);
        // IE11 and Chrome don't set the value to the minVal when max < min
        elVal = maxVal < minVal ? minVal : maxVal;
      }
      ctrl.$setViewValue(elVal);
    } else {
      // TODO(matsko): implement validateLater to reduce number of validations
      ctrl.$validate();
    }
  }

  function stepChange(val) {
    stepVal = parseNumberAttrVal(val);
    // ignore changes before model is initialized
    if (isNumberNaN(ctrl.$modelValue)) {
      return;
    }

    // Some browsers don't adjust the input value correctly, but set the stepMismatch error
    if (supportsRange && ctrl.$viewValue !== element.val()) {
      ctrl.$setViewValue(element.val());
    } else {
      // TODO(matsko): implement validateLater to reduce number of validations
      ctrl.$validate();
    }
  }
}

function urlInputType(scope, element, attr, ctrl, $sniffer, $browser) {
  // Note: no badInputChecker here by purpose as `url` is only a validation
  // in browsers, i.e. we can always read out input.value even if it is not valid!
  baseInputType(scope, element, attr, ctrl, $sniffer, $browser);
  stringBasedInputType(ctrl);

  ctrl.$$parserName = 'url';
  ctrl.$validators.url = function(modelValue, viewValue) {
    var value = modelValue || viewValue;
    return ctrl.$isEmpty(value) || URL_REGEXP.test(value);
  };
}

function emailInputType(scope, element, attr, ctrl, $sniffer, $browser) {
  // Note: no badInputChecker here by purpose as `url` is only a validation
  // in browsers, i.e. we can always read out input.value even if it is not valid!
  baseInputType(scope, element, attr, ctrl, $sniffer, $browser);
  stringBasedInputType(ctrl);

  ctrl.$$parserName = 'email';
  ctrl.$validators.email = function(modelValue, viewValue) {
    var value = modelValue || viewValue;
    return ctrl.$isEmpty(value) || EMAIL_REGEXP.test(value);
  };
}

function radioInputType(scope, element, attr, ctrl) {
  var doTrim = !attr.ngTrim || trim(attr.ngTrim) !== 'false';
  // make the name unique, if not defined
  if (isUndefined(attr.name)) {
    element.attr('name', nextUid());
  }

  var listener = function(ev) {
    var value;
    if (element[0].checked) {
      value = attr.value;
      if (doTrim) {
        value = trim(value);
      }
      ctrl.$setViewValue(value, ev && ev.type);
    }
  };

  element.on('click', listener);

  ctrl.$render = function() {
    var value = attr.value;
    if (doTrim) {
      value = trim(value);
    }
    element[0].checked = (value === ctrl.$viewValue);
  };

  attr.$observe('value', ctrl.$render);
}

function parseConstantExpr($parse, context, name, expression, fallback) {
  var parseFn;
  if (isDefined(expression)) {
    parseFn = $parse(expression);
    if (!parseFn.constant) {
      throw ngModelMinErr('constexpr', 'Expected constant expression for `{0}`, but saw ' +
                                   '`{1}`.', name, expression);
    }
    return parseFn(context);
  }
  return fallback;
}

function checkboxInputType(scope, element, attr, ctrl, $sniffer, $browser, $filter, $parse) {
  var trueValue = parseConstantExpr($parse, scope, 'ngTrueValue', attr.ngTrueValue, true);
  var falseValue = parseConstantExpr($parse, scope, 'ngFalseValue', attr.ngFalseValue, false);

  var listener = function(ev) {
    ctrl.$setViewValue(element[0].checked, ev && ev.type);
  };

  element.on('click', listener);

  ctrl.$render = function() {
    element[0].checked = ctrl.$viewValue;
  };

  // Override the standard `$isEmpty` because the $viewValue of an empty checkbox is always set to `false`
  // This is because of the parser below, which compares the `$modelValue` with `trueValue` to convert
  // it to a boolean.
  ctrl.$isEmpty = function(value) {
    return value === false;
  };

  ctrl.$formatters.push(function(value) {
    return equals(value, trueValue);
  });

  ctrl.$parsers.push(function(value) {
    return value ? trueValue : falseValue;
  });
}


/**
 * @ngdoc directive
 * @name textarea
 * @restrict E
 *
 * @description
 * HTML textarea element control with AngularJS data-binding. The data-binding and validation
 * properties of this element are exactly the same as those of the
 * {@link ng.directive:input input element}.
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
 *    maxlength. Setting the attribute to a negative or non-numeric value, allows view values of any
 *    length.
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
 *
 * @knownIssue
 *
 * When specifying the `placeholder` attribute of `<textarea>`, Internet Explorer will temporarily
 * insert the placeholder value as the textarea's content. If the placeholder value contains
 * interpolation (`{{ ... }}`), an error will be logged in the console when AngularJS tries to update
 * the value of the by-then-removed text node. This doesn't affect the functionality of the
 * textarea, but can be undesirable.
 *
 * You can work around this Internet Explorer issue by using `ng-attr-placeholder` instead of
 * `placeholder` on textareas, whenever you need interpolation in the placeholder value. You can
 * find more details on `ngAttr` in the
 * [Interpolation](guide/interpolation#-ngattr-for-binding-to-arbitrary-attributes) section of the
 * Developer Guide.
 */


/**
 * @ngdoc directive
 * @name input
 * @restrict E
 *
 * @description
 * HTML input element control. When used together with {@link ngModel `ngModel`}, it provides data-binding,
 * input state control, and validation.
 * Input control follows HTML5 input types and polyfills the HTML5 validation behavior for older browsers.
 *
 * <div class="alert alert-warning">
 * **Note:** Not every feature offered is available for all input types.
 * Specifically, data binding and event handling via `ng-model` is unsupported for `input[file]`.
 * </div>
 *
 * @param {string} ngModel Assignable AngularJS expression to data-bind to.
 * @param {string=} name Property name of the form under which the control is published.
 * @param {string=} required Sets `required` validation error key if the value is not entered.
 * @param {boolean=} ngRequired Sets `required` attribute if set to true
 * @param {number=} ngMinlength Sets `minlength` validation error key if the value is shorter than
 *    minlength.
 * @param {number=} ngMaxlength Sets `maxlength` validation error key if the value is longer than
 *    maxlength. Setting the attribute to a negative or non-numeric value, allows view values of any
 *    length.
 * @param {string=} ngPattern Sets `pattern` validation error key if the ngModel {@link ngModel.NgModelController#$viewValue $viewValue}
 *    value does not match a RegExp found by evaluating the AngularJS expression given in the attribute value.
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
    <example name="input-directive" module="inputExample">
      <file name="index.html">
       <script>
          angular.module('inputExample', [])
            .controller('ExampleController', ['$scope', function($scope) {
              $scope.user = {name: 'guest', last: 'visitor'};
            }]);
       </script>
       <div ng-controller="ExampleController">
         <form name="myForm">
           <label>
              User name:
              <input type="text" name="userName" ng-model="user.name" required>
           </label>
           <div role="alert">
             <span class="error" ng-show="myForm.userName.$error.required">
              Required!</span>
           </div>
           <label>
              Last name:
              <input type="text" name="lastName" ng-model="user.last"
              ng-minlength="3" ng-maxlength="10">
           </label>
           <div role="alert">
             <span class="error" ng-show="myForm.lastName.$error.minlength">
               Too short!</span>
             <span class="error" ng-show="myForm.lastName.$error.maxlength">
               Too long!</span>
           </div>
         </form>
         <hr>
         <tt>user = {{user}}</tt><br/>
         <tt>myForm.userName.$valid = {{myForm.userName.$valid}}</tt><br/>
         <tt>myForm.userName.$error = {{myForm.userName.$error}}</tt><br/>
         <tt>myForm.lastName.$valid = {{myForm.lastName.$valid}}</tt><br/>
         <tt>myForm.lastName.$error = {{myForm.lastName.$error}}</tt><br/>
         <tt>myForm.$valid = {{myForm.$valid}}</tt><br/>
         <tt>myForm.$error.required = {{!!myForm.$error.required}}</tt><br/>
         <tt>myForm.$error.minlength = {{!!myForm.$error.minlength}}</tt><br/>
         <tt>myForm.$error.maxlength = {{!!myForm.$error.maxlength}}</tt><br/>
       </div>
      </file>
      <file name="protractor.js" type="protractor">
        var user = element(by.exactBinding('user'));
        var userNameValid = element(by.binding('myForm.userName.$valid'));
        var lastNameValid = element(by.binding('myForm.lastName.$valid'));
        var lastNameError = element(by.binding('myForm.lastName.$error'));
        var formValid = element(by.binding('myForm.$valid'));
        var userNameInput = element(by.model('user.name'));
        var userLastInput = element(by.model('user.last'));

        it('should initialize to model', function() {
          expect(user.getText()).toContain('{"name":"guest","last":"visitor"}');
          expect(userNameValid.getText()).toContain('true');
          expect(formValid.getText()).toContain('true');
        });

        it('should be invalid if empty when required', function() {
          userNameInput.clear();
          userNameInput.sendKeys('');

          expect(user.getText()).toContain('{"last":"visitor"}');
          expect(userNameValid.getText()).toContain('false');
          expect(formValid.getText()).toContain('false');
        });

        it('should be valid if empty when min length is set', function() {
          userLastInput.clear();
          userLastInput.sendKeys('');

          expect(user.getText()).toContain('{"name":"guest","last":""}');
          expect(lastNameValid.getText()).toContain('true');
          expect(formValid.getText()).toContain('true');
        });

        it('should be invalid if less than required min length', function() {
          userLastInput.clear();
          userLastInput.sendKeys('xx');

          expect(user.getText()).toContain('{"name":"guest"}');
          expect(lastNameValid.getText()).toContain('false');
          expect(lastNameError.getText()).toContain('minlength');
          expect(formValid.getText()).toContain('false');
        });

        it('should be invalid if longer than max length', function() {
          userLastInput.clear();
          userLastInput.sendKeys('some ridiculously long name');

          expect(user.getText()).toContain('{"name":"guest"}');
          expect(lastNameValid.getText()).toContain('false');
          expect(lastNameError.getText()).toContain('maxlength');
          expect(formValid.getText()).toContain('false');
        });
      </file>
    </example>
 */
var inputDirective = ['$browser', '$sniffer', '$filter', '$parse',
    function($browser, $sniffer, $filter, $parse) {
  return {
    restrict: 'E',
    require: ['?ngModel'],
    link: {
      pre: function(scope, element, attr, ctrls) {
        if (ctrls[0]) {
          (inputType[lowercase(attr.type)] || inputType.text)(scope, element, attr, ctrls[0], $sniffer,
                                                              $browser, $filter, $parse);
        }
      }
    }
  };
}];



var CONSTANT_VALUE_REGEXP = /^(true|false|\d+)$/;
/**
 * @ngdoc directive
 * @name ngValue
 * @restrict A
 * @priority 100
 *
 * @description
 * Binds the given expression to the value of the element.
 *
 * It is mainly used on {@link input[radio] `input[radio]`} and option elements,
 * so that when the element is selected, the {@link ngModel `ngModel`} of that element (or its
 * {@link select `select`} parent element) is set to the bound value. It is especially useful
 * for dynamically generated lists using {@link ngRepeat `ngRepeat`}, as shown below.
 *
 * It can also be used to achieve one-way binding of a given expression to an input element
 * such as an `input[text]` or a `textarea`, when that element does not use ngModel.
 *
 * @element ANY
 * @param {string=} ngValue AngularJS expression, whose value will be bound to the `value` attribute
 * and `value` property of the element.
 *
 * @example
    <example name="ngValue-directive" module="valueExample">
      <file name="index.html">
       <script>
          angular.module('valueExample', [])
            .controller('ExampleController', ['$scope', function($scope) {
              $scope.names = ['pizza', 'unicorns', 'robots'];
              $scope.my = { favorite: 'unicorns' };
            }]);
       </script>
        <form ng-controller="ExampleController">
          <h2>Which is your favorite?</h2>
            <label ng-repeat="name in names" for="{{name}}">
              {{name}}
              <input type="radio"
                     ng-model="my.favorite"
                     ng-value="name"
                     id="{{name}}"
                     name="favorite">
            </label>
          <div>You chose {{my.favorite}}</div>
        </form>
      </file>
      <file name="protractor.js" type="protractor">
        var favorite = element(by.binding('my.favorite'));

        it('should initialize to model', function() {
          expect(favorite.getText()).toContain('unicorns');
        });
        it('should bind the values to the inputs', function() {
          element.all(by.model('my.favorite')).get(0).click();
          expect(favorite.getText()).toContain('pizza');
        });
      </file>
    </example>
 */
var ngValueDirective = function() {
  /**
   *  inputs use the value attribute as their default value if the value property is not set.
   *  Once the value property has been set (by adding input), it will not react to changes to
   *  the value attribute anymore. Setting both attribute and property fixes this behavior, and
   *  makes it possible to use ngValue as a sort of one-way bind.
   */
  function updateElementValue(element, attr, value) {
    // Support: IE9 only
    // In IE9 values are converted to string (e.g. `input.value = null` results in `input.value === 'null'`).
    var propValue = isDefined(value) ? value : (msie === 9) ? '' : null;
    element.prop('value', propValue);
    attr.$set('value', value);
  }

  return {
    restrict: 'A',
    priority: 100,
    compile: function(tpl, tplAttr) {
      if (CONSTANT_VALUE_REGEXP.test(tplAttr.ngValue)) {
        return function ngValueConstantLink(scope, elm, attr) {
          var value = scope.$eval(attr.ngValue);
          updateElementValue(elm, attr, value);
        };
      } else {
        return function ngValueLink(scope, elm, attr) {
          scope.$watch(attr.ngValue, function valueWatchAction(value) {
            updateElementValue(elm, attr, value);
          });
        };
      }
    }
  };
};

/**
 * @ngdoc directive
 * @name ngBind
 * @restrict AC
 *
 * @description
 * The `ngBind` attribute tells AngularJS to replace the text content of the specified HTML element
 * with the value of a given expression, and to update the text content when the value of that
 * expression changes.
 *
 * Typically, you don't use `ngBind` directly, but instead you use the double curly markup like
 * `{{ expression }}` which is similar but less verbose.
 *
 * It is preferable to use `ngBind` instead of `{{ expression }}` if a template is momentarily
 * displayed by the browser in its raw state before AngularJS compiles it. Since `ngBind` is an
 * element attribute, it makes the bindings invisible to the user while the page is loading.
 *
 * An alternative solution to this problem would be using the
 * {@link ng.directive:ngCloak ngCloak} directive.
 *
 *
 * @element ANY
 * @param {expression} ngBind {@link guide/expression Expression} to evaluate.
 *
 * @example
 * Enter a name in the Live Preview text box; the greeting below the text box changes instantly.
   <example module="bindExample" name="ng-bind">
     <file name="index.html">
       <script>
         angular.module('bindExample', [])
           .controller('ExampleController', ['$scope', function($scope) {
             $scope.name = 'Whirled';
           }]);
       </script>
       <div ng-controller="ExampleController">
         <label>Enter name: <input type="text" ng-model="name"></label><br>
         Hello <span ng-bind="name"></span>!
       </div>
     </file>
     <file name="protractor.js" type="protractor">
       it('should check ng-bind', function() {
         var nameInput = element(by.model('name'));

         expect(element(by.binding('name')).getText()).toBe('Whirled');
         nameInput.clear();
         nameInput.sendKeys('world');
         expect(element(by.binding('name')).getText()).toBe('world');
       });
     </file>
   </example>
 */
var ngBindDirective = ['$compile', function($compile) {
  return {
    restrict: 'AC',
    compile: function ngBindCompile(templateElement) {
      $compile.$$addBindingClass(templateElement);
      return function ngBindLink(scope, element, attr) {
        $compile.$$addBindingInfo(element, attr.ngBind);
        element = element[0];
        scope.$watch(attr.ngBind, function ngBindWatchAction(value) {
          element.textContent = stringify(value);
        });
      };
    }
  };
}];


/**
 * @ngdoc directive
 * @name ngBindTemplate
 *
 * @description
 * The `ngBindTemplate` directive specifies that the element
 * text content should be replaced with the interpolation of the template
 * in the `ngBindTemplate` attribute.
 * Unlike `ngBind`, the `ngBindTemplate` can contain multiple `{{` `}}`
 * expressions. This directive is needed since some HTML elements
 * (such as TITLE and OPTION) cannot contain SPAN elements.
 *
 * @element ANY
 * @param {string} ngBindTemplate template of form
 *   <tt>{{</tt> <tt>expression</tt> <tt>}}</tt> to eval.
 *
 * @example
 * Try it here: enter text in text box and watch the greeting change.
   <example module="bindExample" name="ng-bind-template">
     <file name="index.html">
       <script>
         angular.module('bindExample', [])
           .controller('ExampleController', ['$scope', function($scope) {
             $scope.salutation = 'Hello';
             $scope.name = 'World';
           }]);
       </script>
       <div ng-controller="ExampleController">
        <label>Salutation: <input type="text" ng-model="salutation"></label><br>
        <label>Name: <input type="text" ng-model="name"></label><br>
        <pre ng-bind-template="{{salutation}} {{name}}!"></pre>
       </div>
     </file>
     <file name="protractor.js" type="protractor">
       it('should check ng-bind', function() {
         var salutationElem = element(by.binding('salutation'));
         var salutationInput = element(by.model('salutation'));
         var nameInput = element(by.model('name'));

         expect(salutationElem.getText()).toBe('Hello World!');

         salutationInput.clear();
         salutationInput.sendKeys('Greetings');
         nameInput.clear();
         nameInput.sendKeys('user');

         expect(salutationElem.getText()).toBe('Greetings user!');
       });
     </file>
   </example>
 */
var ngBindTemplateDirective = ['$interpolate', '$compile', function($interpolate, $compile) {
  return {
    compile: function ngBindTemplateCompile(templateElement) {
      $compile.$$addBindingClass(templateElement);
      return function ngBindTemplateLink(scope, element, attr) {
        var interpolateFn = $interpolate(element.attr(attr.$attr.ngBindTemplate));
        $compile.$$addBindingInfo(element, interpolateFn.expressions);
        element = element[0];
        attr.$observe('ngBindTemplate', function(value) {
          element.textContent = isUndefined(value) ? '' : value;
        });
      };
    }
  };
}];


/**
 * @ngdoc directive
 * @name ngBindHtml
 *
 * @description
 * Evaluates the expression and inserts the resulting HTML into the element in a secure way. By default,
 * the resulting HTML content will be sanitized using the {@link ngSanitize.$sanitize $sanitize} service.
 * To utilize this functionality, ensure that `$sanitize` is available, for example, by including {@link
 * ngSanitize} in your module's dependencies (not in core AngularJS). In order to use {@link ngSanitize}
 * in your module's dependencies, you need to include "angular-sanitize.js" in your application.
 *
 * You may also bypass sanitization for values you know are safe. To do so, bind to
 * an explicitly trusted value via {@link ng.$sce#trustAsHtml $sce.trustAsHtml}.  See the example
 * under {@link ng.$sce#show-me-an-example-using-sce- Strict Contextual Escaping (SCE)}.
 *
 * Note: If a `$sanitize` service is unavailable and the bound value isn't explicitly trusted, you
 * will have an exception (instead of an exploit.)
 *
 * @element ANY
 * @param {expression} ngBindHtml {@link guide/expression Expression} to evaluate.
 *
 * @example

   <example module="bindHtmlExample" deps="angular-sanitize.js" name="ng-bind-html">
     <file name="index.html">
       <div ng-controller="ExampleController">
        <p ng-bind-html="myHTML"></p>
       </div>
     </file>

     <file name="script.js">
       angular.module('bindHtmlExample', ['ngSanitize'])
         .controller('ExampleController', ['$scope', function($scope) {
           $scope.myHTML =
              'I am an <code>HTML</code>string with ' +
              '<a href="#">links!</a> and other <em>stuff</em>';
         }]);
     </file>

     <file name="protractor.js" type="protractor">
       it('should check ng-bind-html', function() {
         expect(element(by.binding('myHTML')).getText()).toBe(
             'I am an HTMLstring with links! and other stuff');
       });
     </file>
   </example>
 */
var ngBindHtmlDirective = ['$sce', '$parse', '$compile', function($sce, $parse, $compile) {
  return {
    restrict: 'A',
    compile: function ngBindHtmlCompile(tElement, tAttrs) {
      var ngBindHtmlGetter = $parse(tAttrs.ngBindHtml);
      var ngBindHtmlWatch = $parse(tAttrs.ngBindHtml, function sceValueOf(val) {
        // Unwrap the value to compare the actual inner safe value, not the wrapper object.
        return $sce.valueOf(val);
      });
      $compile.$$addBindingClass(tElement);

      return function ngBindHtmlLink(scope, element, attr) {
        $compile.$$addBindingInfo(element, attr.ngBindHtml);

        scope.$watch(ngBindHtmlWatch, function ngBindHtmlWatchAction() {
          // The watched value is the unwrapped value. To avoid re-escaping, use the direct getter.
          var value = ngBindHtmlGetter(scope);
          element.html($sce.getTrustedHtml(value) || '');
        });
      };
    }
  };
}];

/**
 * @ngdoc directive
 * @name ngChange
 * @restrict A
 *
 * @description
 * Evaluate the given expression when the user changes the input.
 * The expression is evaluated immediately, unlike the JavaScript onchange event
 * which only triggers at the end of a change (usually, when the user leaves the
 * form element or presses the return key).
 *
 * The `ngChange` expression is only evaluated when a change in the input value causes
 * a new value to be committed to the model.
 *
 * It will not be evaluated:
 * * if the value returned from the `$parsers` transformation pipeline has not changed
 * * if the input has continued to be invalid since the model will stay `null`
 * * if the model is changed programmatically and not by a change to the input value
 *
 *
 * Note, this directive requires `ngModel` to be present.
 *
 * @element ANY
 * @param {expression} ngChange {@link guide/expression Expression} to evaluate upon change
 * in input value.
 *
 * @example
 * <example name="ngChange-directive" module="changeExample">
 *   <file name="index.html">
 *     <script>
 *       angular.module('changeExample', [])
 *         .controller('ExampleController', ['$scope', function($scope) {
 *           $scope.counter = 0;
 *           $scope.change = function() {
 *             $scope.counter++;
 *           };
 *         }]);
 *     </script>
 *     <div ng-controller="ExampleController">
 *       <input type="checkbox" ng-model="confirmed" ng-change="change()" id="ng-change-example1" />
 *       <input type="checkbox" ng-model="confirmed" id="ng-change-example2" />
 *       <label for="ng-change-example2">Confirmed</label><br />
 *       <tt>debug = {{confirmed}}</tt><br/>
 *       <tt>counter = {{counter}}</tt><br/>
 *     </div>
 *   </file>
 *   <file name="protractor.js" type="protractor">
 *     var counter = element(by.binding('counter'));
 *     var debug = element(by.binding('confirmed'));
 *
 *     it('should evaluate the expression if changing from view', function() {
 *       expect(counter.getText()).toContain('0');
 *
 *       element(by.id('ng-change-example1')).click();
 *
 *       expect(counter.getText()).toContain('1');
 *       expect(debug.getText()).toContain('true');
 *     });
 *
 *     it('should not evaluate the expression if changing from model', function() {
 *       element(by.id('ng-change-example2')).click();

 *       expect(counter.getText()).toContain('0');
 *       expect(debug.getText()).toContain('true');
 *     });
 *   </file>
 * </example>
 */
var ngChangeDirective = valueFn({
  restrict: 'A',
  require: 'ngModel',
  link: function(scope, element, attr, ctrl) {
    ctrl.$viewChangeListeners.push(function() {
      scope.$eval(attr.ngChange);
    });
  }
});

/* exported
  ngClassDirective,
  ngClassEvenDirective,
  ngClassOddDirective
*/

function classDirective(name, selector) {
  name = 'ngClass' + name;
  var indexWatchExpression;

  return ['$parse', function($parse) {
    return {
      restrict: 'AC',
      link: function(scope, element, attr) {
        var expression = attr[name].trim();
        var isOneTime = (expression.charAt(0) === ':') && (expression.charAt(1) === ':');

        var watchInterceptor = isOneTime ? toFlatValue : toClassString;
        var watchExpression = $parse(expression, watchInterceptor);
        var watchAction = isOneTime ? ngClassOneTimeWatchAction : ngClassWatchAction;

        var classCounts = element.data('$classCounts');
        var oldModulo = true;
        var oldClassString;

        if (!classCounts) {
          // Use createMap() to prevent class assumptions involving property
          // names in Object.prototype
          classCounts = createMap();
          element.data('$classCounts', classCounts);
        }

        if (name !== 'ngClass') {
          if (!indexWatchExpression) {
            indexWatchExpression = $parse('$index', function moduloTwo($index) {
              // eslint-disable-next-line no-bitwise
              return $index & 1;
            });
          }

          scope.$watch(indexWatchExpression, ngClassIndexWatchAction);
        }

        scope.$watch(watchExpression, watchAction, isOneTime);

        function addClasses(classString) {
          classString = digestClassCounts(split(classString), 1);
          attr.$addClass(classString);
        }

        function removeClasses(classString) {
          classString = digestClassCounts(split(classString), -1);
          attr.$removeClass(classString);
        }

        function updateClasses(oldClassString, newClassString) {
          var oldClassArray = split(oldClassString);
          var newClassArray = split(newClassString);

          var toRemoveArray = arrayDifference(oldClassArray, newClassArray);
          var toAddArray = arrayDifference(newClassArray, oldClassArray);

          var toRemoveString = digestClassCounts(toRemoveArray, -1);
          var toAddString = digestClassCounts(toAddArray, 1);

          attr.$addClass(toAddString);
          attr.$removeClass(toRemoveString);
        }

        function digestClassCounts(classArray, count) {
          var classesToUpdate = [];

          forEach(classArray, function(className) {
            if (count > 0 || classCounts[className]) {
              classCounts[className] = (classCounts[className] || 0) + count;
              if (classCounts[className] === +(count > 0)) {
                classesToUpdate.push(className);
              }
            }
          });

          return classesToUpdate.join(' ');
        }

        function ngClassIndexWatchAction(newModulo) {
          // This watch-action should run before the `ngClass[OneTime]WatchAction()`, thus it
          // adds/removes `oldClassString`. If the `ngClass` expression has changed as well, the
          // `ngClass[OneTime]WatchAction()` will update the classes.
          if (newModulo === selector) {
            addClasses(oldClassString);
          } else {
            removeClasses(oldClassString);
          }

          oldModulo = newModulo;
        }

        function ngClassOneTimeWatchAction(newClassValue) {
          var newClassString = toClassString(newClassValue);

          if (newClassString !== oldClassString) {
            ngClassWatchAction(newClassString);
          }
        }

        function ngClassWatchAction(newClassString) {
          if (oldModulo === selector) {
            updateClasses(oldClassString, newClassString);
          }

          oldClassString = newClassString;
        }
      }
    };
  }];

  // Helpers
  function arrayDifference(tokens1, tokens2) {
    if (!tokens1 || !tokens1.length) return [];
    if (!tokens2 || !tokens2.length) return tokens1;

    var values = [];

    outer:
    for (var i = 0; i < tokens1.length; i++) {
      var token = tokens1[i];
      for (var j = 0; j < tokens2.length; j++) {
        if (token === tokens2[j]) continue outer;
      }
      values.push(token);
    }

    return values;
  }

  function split(classString) {
    return classString && classString.split(' ');
  }

  function toClassString(classValue) {
    var classString = classValue;

    if (isArray(classValue)) {
      classString = classValue.map(toClassString).join(' ');
    } else if (isObject(classValue)) {
      classString = Object.keys(classValue).
        filter(function(key) { return classValue[key]; }).
        join(' ');
    }

    return classString;
  }

  function toFlatValue(classValue) {
    var flatValue = classValue;

    if (isArray(classValue)) {
      flatValue = classValue.map(toFlatValue);
    } else if (isObject(classValue)) {
      var hasUndefined = false;

      flatValue = Object.keys(classValue).filter(function(key) {
        var value = classValue[key];

        if (!hasUndefined && isUndefined(value)) {
          hasUndefined = true;
        }

        return value;
      });

      if (hasUndefined) {
        // Prevent the `oneTimeLiteralWatchInterceptor` from unregistering
        // the watcher, by including at least one `undefined` value.
        flatValue.push(undefined);
      }
    }

    return flatValue;
  }
}

/**
 * @ngdoc directive
 * @name ngClass
 * @restrict AC
 * @element ANY
 *
 * @description
 * The `ngClass` directive allows you to dynamically set CSS classes on an HTML element by databinding
 * an expression that represents all classes to be added.
 *
 * The directive operates in three different ways, depending on which of three types the expression
 * evaluates to:
 *
 * 1. If the expression evaluates to a string, the string should be one or more space-delimited class
 * names.
 *
 * 2. If the expression evaluates to an object, then for each key-value pair of the
 * object with a truthy value the corresponding key is used as a class name.
 *
 * 3. If the expression evaluates to an array, each element of the array should either be a string as in
 * type 1 or an object as in type 2. This means that you can mix strings and objects together in an array
 * to give you more control over what CSS classes appear. See the code below for an example of this.
 *
 *
 * The directive won't add duplicate classes if a particular class was already set.
 *
 * When the expression changes, the previously added classes are removed and only then are the
 * new classes added.
 *
 * @knownIssue
 * You should not use {@link guide/interpolation interpolation} in the value of the `class`
 * attribute, when using the `ngClass` directive on the same element.
 * See {@link guide/interpolation#known-issues here} for more info.
 *
 * @animations
 * | Animation                        | Occurs                              |
 * |----------------------------------|-------------------------------------|
 * | {@link ng.$animate#addClass addClass}       | just before the class is applied to the element   |
 * | {@link ng.$animate#removeClass removeClass} | just before the class is removed from the element |
 *
 * ### ngClass and pre-existing CSS3 Transitions/Animations
   The ngClass directive still supports CSS3 Transitions/Animations even if they do not follow the ngAnimate CSS naming structure.
   Upon animation ngAnimate will apply supplementary CSS classes to track the start and end of an animation, but this will not hinder
   any pre-existing CSS transitions already on the element. To get an idea of what happens during a class-based animation, be sure
   to view the step by step details of {@link $animate#addClass $animate.addClass} and
   {@link $animate#removeClass $animate.removeClass}.
 *
 * @param {expression} ngClass {@link guide/expression Expression} to eval. The result
 *   of the evaluation can be a string representing space delimited class
 *   names, an array, or a map of class names to boolean values. In the case of a map, the
 *   names of the properties whose values are truthy will be added as css classes to the
 *   element.
 *
 * @example
 * ### Basic
   <example name="ng-class">
     <file name="index.html">
       <p ng-class="{strike: deleted, bold: important, 'has-error': error}">Map Syntax Example</p>
       <label>
          <input type="checkbox" ng-model="deleted">
          deleted (apply "strike" class)
       </label><br>
       <label>
          <input type="checkbox" ng-model="important">
          important (apply "bold" class)
       </label><br>
       <label>
          <input type="checkbox" ng-model="error">
          error (apply "has-error" class)
       </label>
       <hr>
       <p ng-class="style">Using String Syntax</p>
       <input type="text" ng-model="style"
              placeholder="Type: bold strike red" aria-label="Type: bold strike red">
       <hr>
       <p ng-class="[style1, style2, style3]">Using Array Syntax</p>
       <input ng-model="style1"
              placeholder="Type: bold, strike or red" aria-label="Type: bold, strike or red"><br>
       <input ng-model="style2"
              placeholder="Type: bold, strike or red" aria-label="Type: bold, strike or red 2"><br>
       <input ng-model="style3"
              placeholder="Type: bold, strike or red" aria-label="Type: bold, strike or red 3"><br>
       <hr>
       <p ng-class="[style4, {orange: warning}]">Using Array and Map Syntax</p>
       <input ng-model="style4" placeholder="Type: bold, strike" aria-label="Type: bold, strike"><br>
       <label><input type="checkbox" ng-model="warning"> warning (apply "orange" class)</label>
     </file>
     <file name="style.css">
       .strike {
           text-decoration: line-through;
       }
       .bold {
           font-weight: bold;
       }
       .red {
           color: red;
       }
       .has-error {
           color: red;
           background-color: yellow;
       }
       .orange {
           color: orange;
       }
     </file>
     <file name="protractor.js" type="protractor">
       var ps = element.all(by.css('p'));

       it('should let you toggle the class', function() {

         expect(ps.first().getAttribute('class')).not.toMatch(/bold/);
         expect(ps.first().getAttribute('class')).not.toMatch(/has-error/);

         element(by.model('important')).click();
         expect(ps.first().getAttribute('class')).toMatch(/bold/);

         element(by.model('error')).click();
         expect(ps.first().getAttribute('class')).toMatch(/has-error/);
       });

       it('should let you toggle string example', function() {
         expect(ps.get(1).getAttribute('class')).toBe('');
         element(by.model('style')).clear();
         element(by.model('style')).sendKeys('red');
         expect(ps.get(1).getAttribute('class')).toBe('red');
       });

       it('array example should have 3 classes', function() {
         expect(ps.get(2).getAttribute('class')).toBe('');
         element(by.model('style1')).sendKeys('bold');
         element(by.model('style2')).sendKeys('strike');
         element(by.model('style3')).sendKeys('red');
         expect(ps.get(2).getAttribute('class')).toBe('bold strike red');
       });

       it('array with map example should have 2 classes', function() {
         expect(ps.last().getAttribute('class')).toBe('');
         element(by.model('style4')).sendKeys('bold');
         element(by.model('warning')).click();
         expect(ps.last().getAttribute('class')).toBe('bold orange');
       });
     </file>
   </example>

   @example
   ### Animations

   The example below demonstrates how to perform animations using ngClass.

   <example module="ngAnimate" deps="angular-animate.js" animations="true" name="ng-class">
     <file name="index.html">
      <input id="setbtn" type="button" value="set" ng-click="myVar='my-class'">
      <input id="clearbtn" type="button" value="clear" ng-click="myVar=''">
      <br>
      <span class="base-class" ng-class="myVar">Sample Text</span>
     </file>
     <file name="style.css">
       .base-class {
         transition:all cubic-bezier(0.250, 0.460, 0.450, 0.940) 0.5s;
       }

       .base-class.my-class {
         color: red;
         font-size:3em;
       }
     </file>
     <file name="protractor.js" type="protractor">
       it('should check ng-class', function() {
         expect(element(by.css('.base-class')).getAttribute('class')).not.
           toMatch(/my-class/);

         element(by.id('setbtn')).click();

         expect(element(by.css('.base-class')).getAttribute('class')).
           toMatch(/my-class/);

         element(by.id('clearbtn')).click();

         expect(element(by.css('.base-class')).getAttribute('class')).not.
           toMatch(/my-class/);
       });
     </file>
   </example>
 */
var ngClassDirective = classDirective('', true);

/**
 * @ngdoc directive
 * @name ngClassOdd
 * @restrict AC
 *
 * @description
 * The `ngClassOdd` and `ngClassEven` directives work exactly as
 * {@link ng.directive:ngClass ngClass}, except they work in
 * conjunction with `ngRepeat` and take effect only on odd (even) rows.
 *
 * This directive can be applied only within the scope of an
 * {@link ng.directive:ngRepeat ngRepeat}.
 *
 * @element ANY
 * @param {expression} ngClassOdd {@link guide/expression Expression} to eval. The result
 *   of the evaluation can be a string representing space delimited class names or an array.
 *
 * @example
   <example name="ng-class-odd">
     <file name="index.html">
        <ol ng-init="names=['John', 'Mary', 'Cate', 'Suz']">
          <li ng-repeat="name in names">
           <span ng-class-odd="'odd'" ng-class-even="'even'">
             {{name}}
           </span>
          </li>
        </ol>
     </file>
     <file name="style.css">
       .odd {
         color: red;
       }
       .even {
         color: blue;
       }
     </file>
     <file name="protractor.js" type="protractor">
       it('should check ng-class-odd and ng-class-even', function() {
         expect(element(by.repeater('name in names').row(0).column('name')).getAttribute('class')).
           toMatch(/odd/);
         expect(element(by.repeater('name in names').row(1).column('name')).getAttribute('class')).
           toMatch(/even/);
       });
     </file>
   </example>
 */
var ngClassOddDirective = classDirective('Odd', 0);

/**
 * @ngdoc directive
 * @name ngClassEven
 * @restrict AC
 *
 * @description
 * The `ngClassOdd` and `ngClassEven` directives work exactly as
 * {@link ng.directive:ngClass ngClass}, except they work in
 * conjunction with `ngRepeat` and take effect only on odd (even) rows.
 *
 * This directive can be applied only within the scope of an
 * {@link ng.directive:ngRepeat ngRepeat}.
 *
 * @element ANY
 * @param {expression} ngClassEven {@link guide/expression Expression} to eval. The
 *   result of the evaluation can be a string representing space delimited class names or an array.
 *
 * @example
   <example name="ng-class-even">
     <file name="index.html">
        <ol ng-init="names=['John', 'Mary', 'Cate', 'Suz']">
          <li ng-repeat="name in names">
           <span ng-class-odd="'odd'" ng-class-even="'even'">
             {{name}} &nbsp; &nbsp; &nbsp;
           </span>
          </li>
        </ol>
     </file>
     <file name="style.css">
       .odd {
         color: red;
       }
       .even {
         color: blue;
       }
     </file>
     <file name="protractor.js" type="protractor">
       it('should check ng-class-odd and ng-class-even', function() {
         expect(element(by.repeater('name in names').row(0).column('name')).getAttribute('class')).
           toMatch(/odd/);
         expect(element(by.repeater('name in names').row(1).column('name')).getAttribute('class')).
           toMatch(/even/);
       });
     </file>
   </example>
 */
var ngClassEvenDirective = classDirective('Even', 1);

/**
 * @ngdoc directive
 * @name ngCloak
 * @restrict AC
 *
 * @description
 * The `ngCloak` directive is used to prevent the AngularJS html template from being briefly
 * displayed by the browser in its raw (uncompiled) form while your application is loading. Use this
 * directive to avoid the undesirable flicker effect caused by the html template display.
 *
 * The directive can be applied to the `<body>` element, but the preferred usage is to apply
 * multiple `ngCloak` directives to small portions of the page to permit progressive rendering
 * of the browser view.
 *
 * `ngCloak` works in cooperation with the following css rule embedded within `angular.js` and
 * `angular.min.js`.
 * For CSP mode please add `angular-csp.css` to your html file (see {@link ng.directive:ngCsp ngCsp}).
 *
 * ```css
 * [ng\:cloak], [ng-cloak], [data-ng-cloak], [x-ng-cloak], .ng-cloak, .x-ng-cloak {
 *   display: none !important;
 * }
 * ```
 *
 * When this css rule is loaded by the browser, all html elements (including their children) that
 * are tagged with the `ngCloak` directive are hidden. When AngularJS encounters this directive
 * during the compilation of the template it deletes the `ngCloak` element attribute, making
 * the compiled element visible.
 *
 * For the best result, the `angular.js` script must be loaded in the head section of the html
 * document; alternatively, the css rule above must be included in the external stylesheet of the
 * application.
 *
 * @element ANY
 *
 * @example
   <example name="ng-cloak">
     <file name="index.html">
        <div id="template1" ng-cloak>{{ 'hello' }}</div>
        <div id="template2" class="ng-cloak">{{ 'world' }}</div>
     </file>
     <file name="protractor.js" type="protractor">
       it('should remove the template directive and css class', function() {
         expect($('#template1').getAttribute('ng-cloak')).
           toBeNull();
         expect($('#template2').getAttribute('ng-cloak')).
           toBeNull();
       });
     </file>
   </example>
 *
 */
var ngCloakDirective = ngDirective({
  compile: function(element, attr) {
    attr.$set('ngCloak', undefined);
    element.removeClass('ng-cloak');
  }
});

/**
 * @ngdoc directive
 * @name ngController
 *
 * @description
 * The `ngController` directive attaches a controller class to the view. This is a key aspect of how angular
 * supports the principles behind the Model-View-Controller design pattern.
 *
 * MVC components in angular:
 *
 * * Model â€” Models are the properties of a scope; scopes are attached to the DOM where scope properties
 *   are accessed through bindings.
 * * View â€” The template (HTML with data bindings) that is rendered into the View.
 * * Controller â€” The `ngController` directive specifies a Controller class; the class contains business
 *   logic behind the application to decorate the scope with functions and values
 *
 * Note that you can also attach controllers to the DOM by declaring it in a route definition
 * via the {@link ngRoute.$route $route} service. A common mistake is to declare the controller
 * again using `ng-controller` in the template itself.  This will cause the controller to be attached
 * and executed twice.
 *
 * @element ANY
 * @scope
 * @priority 500
 * @param {expression} ngController Name of a constructor function registered with the current
 * {@link ng.$controllerProvider $controllerProvider} or an {@link guide/expression expression}
 * that on the current scope evaluates to a constructor function.
 *
 * The controller instance can be published into a scope property by specifying
 * `ng-controller="as propertyName"`.
 *
 * If the current `$controllerProvider` is configured to use globals (via
 * {@link ng.$controllerProvider#allowGlobals `$controllerProvider.allowGlobals()` }), this may
 * also be the name of a globally accessible constructor function (deprecated, not recommended).
 *
 * @example
 * Here is a simple form for editing user contact information. Adding, removing, clearing, and
 * greeting are methods declared on the controller (see source tab). These methods can
 * easily be called from the AngularJS markup. Any changes to the data are automatically reflected
 * in the View without the need for a manual update.
 *
 * Two different declaration styles are included below:
 *
 * * one binds methods and properties directly onto the controller using `this`:
 * `ng-controller="SettingsController1 as settings"`
 * * one injects `$scope` into the controller:
 * `ng-controller="SettingsController2"`
 *
 * The second option is more common in the AngularJS community, and is generally used in boilerplates
 * and in this guide. However, there are advantages to binding properties directly to the controller
 * and avoiding scope.
 *
 * * Using `controller as` makes it obvious which controller you are accessing in the template when
 * multiple controllers apply to an element.
 * * If you are writing your controllers as classes you have easier access to the properties and
 * methods, which will appear on the scope, from inside the controller code.
 * * Since there is always a `.` in the bindings, you don't have to worry about prototypal
 * inheritance masking primitives.
 *
 * This example demonstrates the `controller as` syntax.
 *
 * <example name="ngControllerAs" module="controllerAsExample">
 *   <file name="index.html">
 *    <div id="ctrl-as-exmpl" ng-controller="SettingsController1 as settings">
 *      <label>Name: <input type="text" ng-model="settings.name"/></label>
 *      <button ng-click="settings.greet()">greet</button><br/>
 *      Contact:
 *      <ul>
 *        <li ng-repeat="contact in settings.contacts">
 *          <select ng-model="contact.type" aria-label="Contact method" id="select_{{$index}}">
 *             <option>phone</option>
 *             <option>email</option>
 *          </select>
 *          <input type="text" ng-model="contact.value" aria-labelledby="select_{{$index}}" />
 *          <button ng-click="settings.clearContact(contact)">clear</button>
 *          <button ng-click="settings.removeContact(contact)" aria-label="Remove">X</button>
 *        </li>
 *        <li><button ng-click="settings.addContact()">add</button></li>
 *     </ul>
 *    </div>
 *   </file>
 *   <file name="app.js">
 *    angular.module('controllerAsExample', [])
 *      .controller('SettingsController1', SettingsController1);
 *
 *    function SettingsController1() {
 *      this.name = 'John Smith';
 *      this.contacts = [
 *        {type: 'phone', value: '408 555 1212'},
 *        {type: 'email', value: 'john.smith@example.org'}
 *      ];
 *    }
 *
 *    SettingsController1.prototype.greet = function() {
 *      alert(this.name);
 *    };
 *
 *    SettingsController1.prototype.addContact = function() {
 *      this.contacts.push({type: 'email', value: 'yourname@example.org'});
 *    };
 *
 *    SettingsController1.prototype.removeContact = function(contactToRemove) {
 *     var index = this.contacts.indexOf(contactToRemove);
 *      this.contacts.splice(index, 1);
 *    };
 *
 *    SettingsController1.prototype.clearContact = function(contact) {
 *      contact.type = 'phone';
 *      contact.value = '';
 *    };
 *   </file>
 *   <file name="protractor.js" type="protractor">
 *     it('should check controller as', function() {
 *       var container = element(by.id('ctrl-as-exmpl'));
 *         expect(container.element(by.model('settings.name'))
 *           .getAttribute('value')).toBe('John Smith');
 *
 *       var firstRepeat =
 *           container.element(by.repeater('contact in settings.contacts').row(0));
 *       var secondRepeat =
 *           container.element(by.repeater('contact in settings.contacts').row(1));
 *
 *       expect(firstRepeat.element(by.model('contact.value')).getAttribute('value'))
 *           .toBe('408 555 1212');
 *
 *       expect(secondRepeat.element(by.model('contact.value')).getAttribute('value'))
 *           .toBe('john.smith@example.org');
 *
 *       firstRepeat.element(by.buttonText('clear')).click();
 *
 *       expect(firstRepeat.element(by.model('contact.value')).getAttribute('value'))
 *           .toBe('');
 *
 *       container.element(by.buttonText('add')).click();
 *
 *       expect(container.element(by.repeater('contact in settings.contacts').row(2))
 *           .element(by.model('contact.value'))
 *           .getAttribute('value'))
 *           .toBe('yourname@example.org');
 *     });
 *   </file>
 * </example>
 *
 * This example demonstrates the "attach to `$scope`" style of controller.
 *
 * <example name="ngController" module="controllerExample">
 *  <file name="index.html">
 *   <div id="ctrl-exmpl" ng-controller="SettingsController2">
 *     <label>Name: <input type="text" ng-model="name"/></label>
 *     <button ng-click="greet()">greet</button><br/>
 *     Contact:
 *     <ul>
 *       <li ng-repeat="contact in contacts">
 *         <select ng-model="contact.type" id="select_{{$index}}">
 *            <option>phone</option>
 *            <option>email</option>
 *         </select>
 *         <input type="text" ng-model="contact.value" aria-labelledby="select_{{$index}}" />
 *         <button ng-click="clearContact(contact)">clear</button>
 *         <button ng-click="removeContact(contact)">X</button>
 *       </li>
 *       <li>[ <button ng-click="addContact()">add</button> ]</li>
 *    </ul>
 *   </div>
 *  </file>
 *  <file name="app.js">
 *   angular.module('controllerExample', [])
 *     .controller('SettingsController2', ['$scope', SettingsController2]);
 *
 *   function SettingsController2($scope) {
 *     $scope.name = 'John Smith';
 *     $scope.contacts = [
 *       {type:'phone', value:'408 555 1212'},
 *       {type:'email', value:'john.smith@example.org'}
 *     ];
 *
 *     $scope.greet = function() {
 *       alert($scope.name);
 *     };
 *
 *     $scope.addContact = function() {
 *       $scope.contacts.push({type:'email', value:'yourname@example.org'});
 *     };
 *
 *     $scope.removeContact = function(contactToRemove) {
 *       var index = $scope.contacts.indexOf(contactToRemove);
 *       $scope.contacts.splice(index, 1);
 *     };
 *
 *     $scope.clearContact = function(contact) {
 *       contact.type = 'phone';
 *       contact.value = '';
 *     };
 *   }
 *  </file>
 *  <file name="protractor.js" type="protractor">
 *    it('should check controller', function() {
 *      var container = element(by.id('ctrl-exmpl'));
 *
 *      expect(container.element(by.model('name'))
 *          .getAttribute('value')).toBe('John Smith');
 *
 *      var firstRepeat =
 *          container.element(by.repeater('contact in contacts').row(0));
 *      var secondRepeat =
 *          container.element(by.repeater('contact in contacts').row(1));
 *
 *      expect(firstRepeat.element(by.model('contact.value')).getAttribute('value'))
 *          .toBe('408 555 1212');
 *      expect(secondRepeat.element(by.model('contact.value')).getAttribute('value'))
 *          .toBe('john.smith@example.org');
 *
 *      firstRepeat.element(by.buttonText('clear')).click();
 *
 *      expect(firstRepeat.element(by.model('contact.value')).getAttribute('value'))
 *          .toBe('');
 *
 *      container.element(by.buttonText('add')).click();
 *
 *      expect(container.element(by.repeater('contact in contacts').row(2))
 *          .element(by.model('contact.value'))
 *          .getAttribute('value'))
 *          .toBe('yourname@example.org');
 *    });
 *  </file>
 *</example>

 */
var ngControllerDirective = [function() {
  return {
    restrict: 'A',
    scope: true,
    controller: '@',
    priority: 500
  };
}];

/**
 * @ngdoc directive
 * @name ngCsp
 *
 * @restrict A
 * @element ANY
 * @description
 *
 * AngularJS has some features that can conflict with certain restrictions that are applied when using
 * [CSP (Content Security Policy)](https://developer.mozilla.org/en/Security/CSP) rules.
 *
 * If you intend to implement CSP with these rules then you must tell AngularJS not to use these
 * features.
 *
 * This is necessary when developing things like Google Chrome Extensions or Universal Windows Apps.
 *
 *
 * The following default rules in CSP affect AngularJS:
 *
 * * The use of `eval()`, `Function(string)` and similar functions to dynamically create and execute
 * code from strings is forbidden. AngularJS makes use of this in the {@link $parse} service to
 * provide a 30% increase in the speed of evaluating AngularJS expressions. (This CSP rule can be
 * disabled with the CSP keyword `unsafe-eval`, but it is generally not recommended as it would
 * weaken the protections offered by CSP.)
 *
 * * The use of inline resources, such as inline `<script>` and `<style>` elements, are forbidden.
 * This prevents apps from injecting custom styles directly into the document. AngularJS makes use of
 * this to include some CSS rules (e.g. {@link ngCloak} and {@link ngHide}). To make these
 * directives work when a CSP rule is blocking inline styles, you must link to the `angular-csp.css`
 * in your HTML manually. (This CSP rule can be disabled with the CSP keyword `unsafe-inline`, but
 * it is generally not recommended as it would weaken the protections offered by CSP.)
 *
 * If you do not provide `ngCsp` then AngularJS tries to autodetect if CSP is blocking dynamic code
 * creation from strings (e.g., `unsafe-eval` not specified in CSP header) and automatically
 * deactivates this feature in the {@link $parse} service. This autodetection, however, triggers a
 * CSP error to be logged in the console:
 *
 * ```
 * Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of
 * script in the following Content Security Policy directive: "default-src 'self'". Note that
 * 'script-src' was not explicitly set, so 'default-src' is used as a fallback.
 * ```
 *
 * This error is harmless but annoying. To prevent the error from showing up, put the `ngCsp`
 * directive on an element of the HTML document that appears before the `<script>` tag that loads
 * the `angular.js` file.
 *
 * *Note: This directive is only available in the `ng-csp` and `data-ng-csp` attribute form.*
 *
 * You can specify which of the CSP related AngularJS features should be deactivated by providing
 * a value for the `ng-csp` attribute. The options are as follows:
 *
 * * no-inline-style: this stops AngularJS from injecting CSS styles into the DOM
 *
 * * no-unsafe-eval: this stops AngularJS from optimizing $parse with unsafe eval of strings
 *
 * You can use these values in the following combinations:
 *
 *
 * * No declaration means that AngularJS will assume that you can do inline styles, but it will do
 * a runtime check for unsafe-eval. E.g. `<body>`. This is backwardly compatible with previous
 * versions of AngularJS.
 *
 * * A simple `ng-csp` (or `data-ng-csp`) attribute will tell AngularJS to deactivate both inline
 * styles and unsafe eval. E.g. `<body ng-csp>`. This is backwardly compatible with previous
 * versions of AngularJS.
 *
 * * Specifying only `no-unsafe-eval` tells AngularJS that we must not use eval, but that we can
 * inject inline styles. E.g. `<body ng-csp="no-unsafe-eval">`.
 *
 * * Specifying only `no-inline-style` tells AngularJS that we must not inject styles, but that we can
 * run eval - no automatic check for unsafe eval will occur. E.g. `<body ng-csp="no-inline-style">`
 *
 * * Specifying both `no-unsafe-eval` and `no-inline-style` tells AngularJS that we must not inject
 * styles nor use eval, which is the same as an empty: ng-csp.
 * E.g.`<body ng-csp="no-inline-style;no-unsafe-eval">`
 *
 * @example
 *
 * This example shows how to apply the `ngCsp` directive to the `html` tag.
   ```html
     <!doctype html>
     <html ng-app ng-csp>
     ...
     ...
     </html>
   ```

  <!-- Note: the `.csp` suffix in the example name triggers CSP mode in our http server! -->
  <example name="example.csp" module="cspExample" ng-csp="true">
    <file name="index.html">
      <div ng-controller="MainController as ctrl">
        <div>
          <button ng-click="ctrl.inc()" id="inc">Increment</button>
          <span id="counter">
            {{ctrl.counter}}
          </span>
        </div>

        <div>
          <button ng-click="ctrl.evil()" id="evil">Evil</button>
          <span id="evilError">
            {{ctrl.evilError}}
          </span>
        </div>
      </div>
    </file>
    <file name="script.js">
       angular.module('cspExample', [])
         .controller('MainController', function MainController() {
            this.counter = 0;
            this.inc = function() {
              this.counter++;
            };
            this.evil = function() {
              try {
                eval('1+2'); // eslint-disable-line no-eval
              } catch (e) {
                this.evilError = e.message;
              }
            };
          });
    </file>
    <file name="protractor.js" type="protractor">
      var util, webdriver;

      var incBtn = element(by.id('inc'));
      var counter = element(by.id('counter'));
      var evilBtn = element(by.id('evil'));
      var evilError = element(by.id('evilError'));

      function getAndClearSevereErrors() {
        return browser.manage().logs().get('browser').then(function(browserLog) {
          return browserLog.filter(function(logEntry) {
            return logEntry.level.value > webdriver.logging.Level.WARNING.value;
          });
        });
      }

      function clearErrors() {
        getAndClearSevereErrors();
      }

      function expectNoErrors() {
        getAndClearSevereErrors().then(function(filteredLog) {
          expect(filteredLog.length).toEqual(0);
          if (filteredLog.length) {
            console.log('browser console errors: ' + util.inspect(filteredLog));
          }
        });
      }

      function expectError(regex) {
        getAndClearSevereErrors().then(function(filteredLog) {
          var found = false;
          filteredLog.forEach(function(log) {
            if (log.message.match(regex)) {
              found = true;
            }
          });
          if (!found) {
            throw new Error('expected an error that matches ' + regex);
          }
        });
      }

      beforeEach(function() {
        util = require('util');
        webdriver = require('selenium-webdriver');
      });

      // For now, we only test on Chrome,
      // as Safari does not load the page with Protractor's injected scripts,
      // and Firefox webdriver always disables content security policy (#6358)
      if (browser.params.browser !== 'chrome') {
        return;
      }

      it('should not report errors when the page is loaded', function() {
        // clear errors so we are not dependent on previous tests
        clearErrors();
        // Need to reload the page as the page is already loaded when
        // we come here
        browser.driver.getCurrentUrl().then(function(url) {
          browser.get(url);
        });
        expectNoErrors();
      });

      it('should evaluate expressions', function() {
        expect(counter.getText()).toEqual('0');
        incBtn.click();
        expect(counter.getText()).toEqual('1');
        expectNoErrors();
      });

      it('should throw and report an error when using "eval"', function() {
        evilBtn.click();
        expect(evilError.getText()).toMatch(/Content Security Policy/);
        expectError(/Content Security Policy/);
      });
    </file>
  </example>
  */

// `ngCsp` is not implemented as a proper directive any more, because we need it be processed while
// we bootstrap the app (before `$parse` is instantiated). For this reason, we just have the `csp()`
// fn that looks for the `ng-csp` attribute anywhere in the current doc.

/**
 * @ngdoc directive
 * @name ngClick
 * @restrict A
 * @element ANY
 * @priority 0
 *
 * @description
 * The ngClick directive allows you to specify custom behavior when
 * an element is clicked.
 *
 * @param {expression} ngClick {@link guide/expression Expression} to evaluate upon
 * click. ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
   <example name="ng-click">
     <file name="index.html">
      <button ng-click="count = count + 1" ng-init="count=0">
        Increment
      </button>
      <span>
        count: {{count}}
      </span>
     </file>
     <file name="protractor.js" type="protractor">
       it('should check ng-click', function() {
         expect(element(by.binding('count')).getText()).toMatch('0');
         element(by.css('button')).click();
         expect(element(by.binding('count')).getText()).toMatch('1');
       });
     </file>
   </example>
 */
/*
 * A collection of directives that allows creation of custom event handlers that are defined as
 * AngularJS expressions and are compiled and executed within the current scope.
 */
var ngEventDirectives = {};

// For events that might fire synchronously during DOM manipulation
// we need to execute their event handlers asynchronously using $evalAsync,
// so that they are not executed in an inconsistent state.
var forceAsyncEvents = {
  'blur': true,
  'focus': true
};
forEach(
  'click dblclick mousedown mouseup mouseover mouseout mousemove mouseenter mouseleave keydown keyup keypress submit focus blur copy cut paste'.split(' '),
  function(eventName) {
    var directiveName = directiveNormalize('ng-' + eventName);
    ngEventDirectives[directiveName] = ['$parse', '$rootScope', function($parse, $rootScope) {
      return {
        restrict: 'A',
        compile: function($element, attr) {
          // NOTE:
          // We expose the powerful `$event` object on the scope that provides access to the Window,
          // etc. This is OK, because expressions are not sandboxed any more (and the expression
          // sandbox was never meant to be a security feature anyway).
          var fn = $parse(attr[directiveName]);
          return function ngEventHandler(scope, element) {
            element.on(eventName, function(event) {
              var callback = function() {
                fn(scope, {$event: event});
              };
              if (forceAsyncEvents[eventName] && $rootScope.$$phase) {
                scope.$evalAsync(callback);
              } else {
                scope.$apply(callback);
              }
            });
          };
        }
      };
    }];
  }
);

/**
 * @ngdoc directive
 * @name ngDblclick
 * @restrict A
 * @element ANY
 * @priority 0
 *
 * @description
 * The `ngDblclick` directive allows you to specify custom behavior on a dblclick event.
 *
 * @param {expression} ngDblclick {@link guide/expression Expression} to evaluate upon
 * a dblclick. (The Event object is available as `$event`)
 *
 * @example
   <example name="ng-dblclick">
     <file name="index.html">
      <button ng-dblclick="count = count + 1" ng-init="count=0">
        Increment (on double click)
      </button>
      count: {{count}}
     </file>
   </example>
 */


/**
 * @ngdoc directive
 * @name ngMousedown
 * @restrict A
 * @element ANY
 * @priority 0
 *
 * @description
 * The ngMousedown directive allows you to specify custom behavior on mousedown event.
 *
 * @param {expression} ngMousedown {@link guide/expression Expression} to evaluate upon
 * mousedown. ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
   <example name="ng-mousedown">
     <file name="index.html">
      <button ng-mousedown="count = count + 1" ng-init="count=0">
        Increment (on mouse down)
      </button>
      count: {{count}}
     </file>
   </example>
 */


/**
 * @ngdoc directive
 * @name ngMouseup
 * @restrict A
 * @element ANY
 * @priority 0
 *
 * @description
 * Specify custom behavior on mouseup event.
 *
 * @param {expression} ngMouseup {@link guide/expression Expression} to evaluate upon
 * mouseup. ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
   <example name="ng-mouseup">
     <file name="index.html">
      <button ng-mouseup="count = count + 1" ng-init="count=0">
        Increment (on mouse up)
      </button>
      count: {{count}}
     </file>
   </example>
 */

/**
 * @ngdoc directive
 * @name ngMouseover
 * @restrict A
 * @element ANY
 * @priority 0
 *
 * @description
 * Specify custom behavior on mouseover event.
 *
 * @param {expression} ngMouseover {@link guide/expression Expression} to evaluate upon
 * mouseover. ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
   <example name="ng-mouseover">
     <file name="index.html">
      <button ng-mouseover="count = count + 1" ng-init="count=0">
        Increment (when mouse is over)
      </button>
      count: {{count}}
     </file>
   </example>
 */


/**
 * @ngdoc directive
 * @name ngMouseenter
 * @restrict A
 * @element ANY
 * @priority 0
 *
 * @description
 * Specify custom behavior on mouseenter event.
 *
 * @param {expression} ngMouseenter {@link guide/expression Expression} to evaluate upon
 * mouseenter. ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
   <example name="ng-mouseenter">
     <file name="index.html">
      <button ng-mouseenter="count = count + 1" ng-init="count=0">
        Increment (when mouse enters)
      </button>
      count: {{count}}
     </file>
   </example>
 */


/**
 * @ngdoc directive
 * @name ngMouseleave
 * @restrict A
 * @element ANY
 * @priority 0
 *
 * @description
 * Specify custom behavior on mouseleave event.
 *
 * @param {expression} ngMouseleave {@link guide/expression Expression} to evaluate upon
 * mouseleave. ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
   <example name="ng-mouseleave">
     <file name="index.html">
      <button ng-mouseleave="count = count + 1" ng-init="count=0">
        Increment (when mouse leaves)
      </button>
      count: {{count}}
     </file>
   </example>
 */


/**
 * @ngdoc directive
 * @name ngMousemove
 * @restrict A
 * @element ANY
 * @priority 0
 *
 * @description
 * Specify custom behavior on mousemove event.
 *
 * @param {expression} ngMousemove {@link guide/expression Expression} to evaluate upon
 * mousemove. ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
   <example name="ng-mousemove">
     <file name="index.html">
      <button ng-mousemove="count = count + 1" ng-init="count=0">
        Increment (when mouse moves)
      </button>
      count: {{count}}
     </file>
   </example>
 */


/**
 * @ngdoc directive
 * @name ngKeydown
 * @restrict A
 * @element ANY
 * @priority 0
 *
 * @description
 * Specify custom behavior on keydown event.
 *
 * @param {expression} ngKeydown {@link guide/expression Expression} to evaluate upon
 * keydown. (Event object is available as `$event` and can be interrogated for keyCode, altKey, etc.)
 *
 * @example
   <example name="ng-keydown">
     <file name="index.html">
      <input ng-keydown="count = count + 1" ng-init="count=0">
      key down count: {{count}}
     </file>
   </example>
 */


/**
 * @ngdoc directive
 * @name ngKeyup
 * @restrict A
 * @element ANY
 * @priority 0
 *
 * @description
 * Specify custom behavior on keyup event.
 *
 * @param {expression} ngKeyup {@link guide/expression Expression} to evaluate upon
 * keyup. (Event object is available as `$event` and can be interrogated for keyCode, altKey, etc.)
 *
 * @example
   <example name="ng-keyup">
     <file name="index.html">
       <p>Typing in the input box below updates the key count</p>
       <input ng-keyup="count = count + 1" ng-init="count=0"> key up count: {{count}}

       <p>Typing in the input box below updates the keycode</p>
       <input ng-keyup="event=$event">
       <p>event keyCode: {{ event.keyCode }}</p>
       <p>event altKey: {{ event.altKey }}</p>
     </file>
   </example>
 */


/**
 * @ngdoc directive
 * @name ngKeypress
 * @restrict A
 * @element ANY
 *
 * @description
 * Specify custom behavior on keypress event.
 *
 * @param {expression} ngKeypress {@link guide/expression Expression} to evaluate upon
 * keypress. ({@link guide/expression#-event- Event object is available as `$event`}
 * and can be interrogated for keyCode, altKey, etc.)
 *
 * @example
   <example name="ng-keypress">
     <file name="index.html">
      <input ng-keypress="count = count + 1" ng-init="count=0">
      key press count: {{count}}
     </file>
   </example>
 */


/**
 * @ngdoc directive
 * @name ngSubmit
 * @restrict A
 * @element form
 * @priority 0
 *
 * @description
 * Enables binding AngularJS expressions to onsubmit events.
 *
 * Additionally it prevents the default action (which for form means sending the request to the
 * server and reloading the current page), but only if the form does not contain `action`,
 * `data-action`, or `x-action` attributes.
 *
 * <div class="alert alert-warning">
 * **Warning:** Be careful not to cause "double-submission" by using both the `ngClick` and
 * `ngSubmit` handlers together. See the
 * {@link form#submitting-a-form-and-preventing-the-default-action `form` directive documentation}
 * for a detailed discussion of when `ngSubmit` may be triggered.
 * </div>
 *
 * @param {expression} ngSubmit {@link guide/expression Expression} to eval.
 * ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
   <example module="submitExample" name="ng-submit">
     <file name="index.html">
      <script>
        angular.module('submitExample', [])
          .controller('ExampleController', ['$scope', function($scope) {
            $scope.list = [];
            $scope.text = 'hello';
            $scope.submit = function() {
              if ($scope.text) {
                $scope.list.push(this.text);
                $scope.text = '';
              }
            };
          }]);
      </script>
      <form ng-submit="submit()" ng-controller="ExampleController">
        Enter text and hit enter:
        <input type="text" ng-model="text" name="text" />
        <input type="submit" id="submit" value="Submit" />
        <pre>list={{list}}</pre>
      </form>
     </file>
     <file name="protractor.js" type="protractor">
       it('should check ng-submit', function() {
         expect(element(by.binding('list')).getText()).toBe('list=[]');
         element(by.css('#submit')).click();
         expect(element(by.binding('list')).getText()).toContain('hello');
         expect(element(by.model('text')).getAttribute('value')).toBe('');
       });
       it('should ignore empty strings', function() {
         expect(element(by.binding('list')).getText()).toBe('list=[]');
         element(by.css('#submit')).click();
         element(by.css('#submit')).click();
         expect(element(by.binding('list')).getText()).toContain('hello');
        });
     </file>
   </example>
 */

/**
 * @ngdoc directive
 * @name ngFocus
 * @restrict A
 * @element window, input, select, textarea, a
 * @priority 0
 *
 * @description
 * Specify custom behavior on focus event.
 *
 * Note: As the `focus` event is executed synchronously when calling `input.focus()`
 * AngularJS executes the expression using `scope.$evalAsync` if the event is fired
 * during an `$apply` to ensure a consistent state.
 *
 * @param {expression} ngFocus {@link guide/expression Expression} to evaluate upon
 * focus. ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
 * See {@link ng.directive:ngClick ngClick}
 */

/**
 * @ngdoc directive
 * @name ngBlur
 * @restrict A
 * @element window, input, select, textarea, a
 * @priority 0
 *
 * @description
 * Specify custom behavior on blur event.
 *
 * A [blur event](https://developer.mozilla.org/en-US/docs/Web/Events/blur) fires when
 * an element has lost focus.
 *
 * Note: As the `blur` event is executed synchronously also during DOM manipulations
 * (e.g. removing a focussed input),
 * AngularJS executes the expression using `scope.$evalAsync` if the event is fired
 * during an `$apply` to ensure a consistent state.
 *
 * @param {expression} ngBlur {@link guide/expression Expression} to evaluate upon
 * blur. ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
 * See {@link ng.directive:ngClick ngClick}
 */

/**
 * @ngdoc directive
 * @name ngCopy
 * @restrict A
 * @element window, input, select, textarea, a
 * @priority 0
 *
 * @description
 * Specify custom behavior on copy event.
 *
 * @param {expression} ngCopy {@link guide/expression Expression} to evaluate upon
 * copy. ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
   <example name="ng-copy">
     <file name="index.html">
      <input ng-copy="copied=true" ng-init="copied=false; value='copy me'" ng-model="value">
      copied: {{copied}}
     </file>
   </example>
 */

/**
 * @ngdoc directive
 * @name ngCut
 * @restrict A
 * @element window, input, select, textarea, a
 * @priority 0
 *
 * @description
 * Specify custom behavior on cut event.
 *
 * @param {expression} ngCut {@link guide/expression Expression} to evaluate upon
 * cut. ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
   <example name="ng-cut">
     <file name="index.html">
      <input ng-cut="cut=true" ng-init="cut=false; value='cut me'" ng-model="value">
      cut: {{cut}}
     </file>
   </example>
 */

/**
 * @ngdoc directive
 * @name ngPaste
 * @restrict A
 * @element window, input, select, textarea, a
 * @priority 0
 *
 * @description
 * Specify custom behavior on paste event.
 *
 * @param {expression} ngPaste {@link guide/expression Expression} to evaluate upon
 * paste. ({@link guide/expression#-event- Event object is available as `$event`})
 *
 * @example
   <example name="ng-paste">
     <file name="index.html">
      <input ng-paste="paste=true" ng-init="paste=false" placeholder='paste here'>
      pasted: {{paste}}
     </file>
   </example>
 */

/**
 * @ngdoc directive
 * @name ngIf
 * @restrict A
 * @multiElement
 *
 * @description
 * The `ngIf` directive removes or recreates a portion of the DOM tree based on an
 * {expression}. If the expression assigned to `ngIf` evaluates to a false
 * value then the element is removed from the DOM, otherwise a clone of the
 * element is reinserted into the DOM.
 *
 * `ngIf` differs from `ngShow` and `ngHide` in that `ngIf` completely removes and recreates the
 * element in the DOM rather than changing its visibility via the `display` css property.  A common
 * case when this difference is significant is when using css selectors that rely on an element's
 * position within the DOM, such as the `:first-child` or `:last-child` pseudo-classes.
 *
 * Note that when an element is removed using `ngIf` its scope is destroyed and a new scope
 * is created when the element is restored.  The scope created within `ngIf` inherits from
 * its parent scope using
 * [prototypal inheritance](https://github.com/angular/angular.js/wiki/Understanding-Scopes#javascript-prototypal-inheritance).
 * An important implication of this is if `ngModel` is used within `ngIf` to bind to
 * a javascript primitive defined in the parent scope. In this case any modifications made to the
 * variable within the child scope will override (hide) the value in the parent scope.
 *
 * Also, `ngIf` recreates elements using their compiled state. An example of this behavior
 * is if an element's class attribute is directly modified after it's compiled, using something like
 * jQuery's `.addClass()` method, and the element is later removed. When `ngIf` recreates the element
 * the added class will be lost because the original compiled state is used to regenerate the element.
 *
 * Additionally, you can provide animations via the `ngAnimate` module to animate the `enter`
 * and `leave` effects.
 *
 * @animations
 * | Animation                        | Occurs                               |
 * |----------------------------------|-------------------------------------|
 * | {@link ng.$animate#enter enter}  | just after the `ngIf` contents change and a new DOM element is created and injected into the `ngIf` container |
 * | {@link ng.$animate#leave leave}  | just before the `ngIf` contents are removed from the DOM |
 *
 * @element ANY
 * @scope
 * @priority 600
 * @param {expression} ngIf If the {@link guide/expression expression} is falsy then
 *     the element is removed from the DOM tree. If it is truthy a copy of the compiled
 *     element is added to the DOM tree.
 *
 * @example
  <example module="ngAnimate" deps="angular-animate.js" animations="true" name="ng-if">
    <file name="index.html">
      <label>Click me: <input type="checkbox" ng-model="checked" ng-init="checked=true" /></label><br/>
      Show when checked:
      <span ng-if="checked" class="animate-if">
        This is removed when the checkbox is unchecked.
      </span>
    </file>
    <file name="animations.css">
      .animate-if {
        background:white;
        border:1px solid black;
        padding:10px;
      }

      .animate-if.ng-enter, .animate-if.ng-leave {
        transition:all cubic-bezier(0.250, 0.460, 0.450, 0.940) 0.5s;
      }

      .animate-if.ng-enter,
      .animate-if.ng-leave.ng-leave-active {
        opacity:0;
      }

      .animate-if.ng-leave,
      .animate-if.ng-enter.ng-enter-active {
        opacity:1;
      }
    </file>
  </example>
 */
var ngIfDirective = ['$animate', '$compile', function($animate, $compile) {
  return {
    multiElement: true,
    transclude: 'element',
    priority: 600,
    terminal: true,
    restrict: 'A',
    $$tlb: true,
    link: function($scope, $element, $attr, ctrl, $transclude) {
        var block, childScope, previousElements;
        $scope.$watch($attr.ngIf, function ngIfWatchAction(value) {

          if (value) {
            if (!childScope) {
              $transclude(function(clone, newScope) {
                childScope = newScope;
                clone[clone.length++] = $compile.$$createComment('end ngIf', $attr.ngIf);
                // Note: We only need the first/last node of the cloned nodes.
                // However, we need to keep the reference to the jqlite wrapper as it might be changed later
                // by a directive with templateUrl when its template arrives.
                block = {
                  clone: clone
                };
                $animate.enter(clone, $element.parent(), $element);
              });
            }
          } else {
            if (previousElements) {
              previousElements.remove();
              previousElements = null;
            }
            if (childScope) {
              childScope.$destroy();
              childScope = null;
            }
            if (block) {
              previousElements = getBlockNodes(block.clone);
              $animate.leave(previousElements).done(function(response) {
                if (response !== false) previousElements = null;
              });
              block = null;
            }
          }
        });
    }
  };
}];

/**
 * @ngdoc directive
 * @name ngInclude
 * @restrict ECA
 * @scope
 * @priority -400
 *
 * @description
 * Fetches, compiles and includes an external HTML fragment.
 *
 * By default, the template URL is restricted to the same domain and protocol as the
 * application document. This is done by calling {@link $sce#getTrustedResourceUrl
 * $sce.getTrustedResourceUrl} on it. To load templates from other domains or protocols
 * you may either {@link ng.$sceDelegateProvider#resourceUrlWhitelist whitelist them} or
 * {@link $sce#trustAsResourceUrl wrap them} as trusted values. Refer to AngularJS's {@link
 * ng.$sce Strict Contextual Escaping}.
 *
 * In addition, the browser's
 * [Same Origin Policy](https://code.google.com/p/browsersec/wiki/Part2#Same-origin_policy_for_XMLHttpRequest)
 * and [Cross-Origin Resource Sharing (CORS)](http://www.w3.org/TR/cors/)
 * policy may further restrict whether the template is successfully loaded.
 * For example, `ngInclude` won't work for cross-domain requests on all browsers and for `file://`
 * access on some browsers.
 *
 * @animations
 * | Animation                        | Occurs                              |
 * |----------------------------------|-------------------------------------|
 * | {@link ng.$animate#enter enter}  | when the expression changes, on the new include |
 * | {@link ng.$animate#leave leave}  | when the expression changes, on the old include |
 *
 * The enter and leave animation occur concurrently.
 *
 * @param {string} ngInclude|src AngularJS expression evaluating to URL. If the source is a string constant,
 *                 make sure you wrap it in **single** quotes, e.g. `src="'myPartialTemplate.html'"`.
 * @param {string=} onload Expression to evaluate when a new partial is loaded.
 *                  <div class="alert alert-warning">
 *                  **Note:** When using onload on SVG elements in IE11, the browser will try to call
 *                  a function with the name on the window element, which will usually throw a
 *                  "function is undefined" error. To fix this, you can instead use `data-onload` or a
 *                  different form that {@link guide/directive#normalization matches} `onload`.
 *                  </div>
   *
 * @param {string=} autoscroll Whether `ngInclude` should call {@link ng.$anchorScroll
 *                  $anchorScroll} to scroll the viewport after the content is loaded.
 *
 *                  - If the attribute is not set, disable scrolling.
 *                  - If the attribute is set without value, enable scrolling.
 *                  - Otherwise enable scrolling only if the expression evaluates to truthy value.
 *
 * @example
  <example module="includeExample" deps="angular-animate.js" animations="true" name="ng-include">
    <file name="index.html">
     <div ng-controller="ExampleController">
       <select ng-model="template" ng-options="t.name for t in templates">
        <option value="">(blank)</option>
       </select>
       url of the template: <code>{{template.url}}</code>
       <hr/>
       <div class="slide-animate-container">
         <div class="slide-animate" ng-include="template.url"></div>
       </div>
     </div>
    </file>
    <file name="script.js">
      angular.module('includeExample', ['ngAnimate'])
        .controller('ExampleController', ['$scope', function($scope) {
          $scope.templates =
            [{ name: 'template1.html', url: 'template1.html'},
             { name: 'template2.html', url: 'template2.html'}];
          $scope.template = $scope.templates[0];
        }]);
     </file>
    <file name="template1.html">
      Content of template1.html
    </file>
    <file name="template2.html">
      Content of template2.html
    </file>
    <file name="animations.css">
      .slide-animate-container {
        position:relative;
        background:white;
        border:1px solid black;
        height:40px;
        overflow:hidden;
      }

      .slide-animate {
        padding:10px;
      }

      .slide-animate.ng-enter, .slide-animate.ng-leave {
        transition:all cubic-bezier(0.250, 0.460, 0.450, 0.940) 0.5s;

        position:absolute;
        top:0;
        left:0;
        right:0;
        bottom:0;
        display:block;
        padding:10px;
      }

      .slide-animate.ng-enter {
        top:-50px;
      }
      .slide-animate.ng-enter.ng-enter-active {
        top:0;
      }

      .slide-animate.ng-leave {
        top:0;
      }
      .slide-animate.ng-leave.ng-leave-active {
        top:50px;
      }
    </file>
    <file name="protractor.js" type="protractor">
      var templateSelect = element(by.model('template'));
      var includeElem = element(by.css('[ng-include]'));

      it('should load template1.html', function() {
        expect(includeElem.getText()).toMatch(/Content of template1.html/);
      });

      it('should load template2.html', function() {
        if (browser.params.browser === 'firefox') {
          // Firefox can't handle using selects
          // See https://github.com/angular/protractor/issues/480
          return;
        }
        templateSelect.click();
        templateSelect.all(by.css('option')).get(2).click();
        expect(includeElem.getText()).toMatch(/Content of template2.html/);
      });

      it('should change to blank', function() {
        if (browser.params.browser === 'firefox') {
          // Firefox can't handle using selects
          return;
        }
        templateSelect.click();
        templateSelect.all(by.css('option')).get(0).click();
        expect(includeElem.isPresent()).toBe(false);
      });
    </file>
  </example>
 */


/**
 * @ngdoc event
 * @name ngInclude#$includeContentRequested
 * @eventType emit on the scope ngInclude was declared in
 * @description
 * Emitted every time the ngInclude content is requested.
 *
 * @param {Object} angularEvent Synthetic event object.
 * @param {String} src URL of content to load.
 */


/**
 * @ngdoc event
 * @name ngInclude#$includeContentLoaded
 * @eventType emit on the current ngInclude scope
 * @description
 * Emitted every time the ngInclude content is reloaded.
 *
 * @param {Object} angularEvent Synthetic event object.
 * @param {String} src URL of content to load.
 */


/**
 * @ngdoc event
 * @name ngInclude#$includeContentError
 * @eventType emit on the scope ngInclude was declared in
 * @description
 * Emitted when a template HTTP request yields an erroneous response (status < 200 || status > 299)
 *
 * @param {Object} angularEvent Synthetic event object.
 * @param {String} src URL of content to load.
 */
var ngIncludeDirective = ['$templateRequest', '$anchorScroll', '$animate',
                  function($templateRequest,   $anchorScroll,   $animate) {
  return {
    restrict: 'ECA',
    priority: 400,
    terminal: true,
    transclude: 'element',
    controller: angular.noop,
    compile: function(element, attr) {
      var srcExp = attr.ngInclude || attr.src,
          onloadExp = attr.onload || '',
          autoScrollExp = attr.autoscroll;

      return function(scope, $element, $attr, ctrl, $transclude) {
        var changeCounter = 0,
            currentScope,
            previousElement,
            currentElement;

        var cleanupLastIncludeContent = function() {
          if (previousElement) {
            previousElement.remove();
            previousElement = null;
          }
          if (currentScope) {
            currentScope.$destroy();
            currentScope = null;
          }
          if (currentElement) {
            $animate.leave(currentElement).done(function(response) {
              if (response !== false) previousElement = null;
            });
            previousElement = currentElement;
            currentElement = null;
          }
        };

        scope.$watch(srcExp, function ngIncludeWatchAction(src) {
          var afterAnimation = function(response) {
            if (response !== false && isDefined(autoScrollExp) &&
              (!autoScrollExp || scope.$eval(autoScrollExp))) {
                $anchorScroll();
            }
          };
          var thisChangeId = ++changeCounter;

          if (src) {
            //set the 2nd param to true to ignore the template request error so that the inner
            //contents and scope can be cleaned up.
            $templateRequest(src, true).then(function(response) {
              if (scope.$$destroyed) return;

              if (thisChangeId !== changeCounter) return;
              var newScope = scope.$new();
              ctrl.template = response;

              // Note: This will also link all children of ng-include that were contained in the original
              // html. If that content contains controllers, ... they could pollute/change the scope.
              // However, using ng-include on an element with additional content does not make sense...
              // Note: We can't remove them in the cloneAttchFn of $transclude as that
              // function is called before linking the content, which would apply child
              // directives to non existing elements.
              var clone = $transclude(newScope, function(clone) {
                cleanupLastIncludeContent();
                $animate.enter(clone, null, $element).done(afterAnimation);
              });

              currentScope = newScope;
              currentElement = clone;

              currentScope.$emit('$includeContentLoaded', src);
              scope.$eval(onloadExp);
            }, function() {
              if (scope.$$destroyed) return;

              if (thisChangeId === changeCounter) {
                cleanupLastIncludeContent();
                scope.$emit('$includeContentError', src);
              }
            });
            scope.$emit('$includeContentRequested', src);
          } else {
            cleanupLastIncludeContent();
            ctrl.template = null;
          }
        });
      };
    }
  };
}];

// This directive is called during the $transclude call of the first `ngInclude` directive.
// It will replace and compile the content of the element with the loaded template.
// We need this directive so that the element content is already filled when
// the link function of another directive on the same element as ngInclude
// is called.
var ngIncludeFillContentDirective = ['$compile',
  function($compile) {
    return {
      restrict: 'ECA',
      priority: -400,
      require: 'ngInclude',
      link: function(scope, $element, $attr, ctrl) {
        if (toString.call($element[0]).match(/SVG/)) {
          // WebKit: https://bugs.webkit.org/show_bug.cgi?id=135698 --- SVG elements do not
          // support innerHTML, so detect this here and try to generate the contents
          // specially.
          $element.empty();
          $compile(jqLiteBuildFragment(ctrl.template, window.document).childNodes)(scope,
              function namespaceAdaptedClone(clone) {
            $element.append(clone);
          }, {futureParentElement: $element});
          return;
        }

        $element.html(ctrl.template);
        $compile($element.contents())(scope);
      }
    };
  }];

/**
 * @ngdoc directive
 * @name ngInit
 * @restrict AC
 * @priority 450
 * @element ANY
 *
 * @param {expression} ngInit {@link guide/expression Expression} to eval.
 *
 * @description
 * The `ngInit` directive allows you to evaluate an expression in the
 * current scope.
 *
 * <div class="alert alert-danger">
 * This directive can be abused to add unnecessary amounts of logic into your templates.
 * There are only a few appropriate uses of `ngInit`:
 * <ul>
 *   <li>aliasing special properties of {@link ng.directive:ngRepeat `ngRepeat`},
 *     as seen in the demo below.</li>
 *   <li>initializing data during development, or for examples, as seen throughout these docs.</li>
 *   <li>injecting data via server side scripting.</li>
 * </ul>
 *
 * Besides these few cases, you should use {@link guide/component Components} or
 * {@link guide/controller Controllers} rather than `ngInit` to initialize values on a scope.
 * </div>
 *
 * <div class="alert alert-warning">
 * **Note**: If you have assignment in `ngInit` along with a {@link ng.$filter `filter`}, make
 * sure you have parentheses to ensure correct operator precedence:
 * <pre class="prettyprint">
 * `<div ng-init="test1 = ($index | toString)"></div>`
 * </pre>
 * </div>
 *
 * @example
   <example module="initExample" name="ng-init">
     <file name="index.html">
   <script>
     angular.module('initExample', [])
       .controller('ExampleController', ['$scope', function($scope) {
         $scope.list = [['a', 'b'], ['c', 'd']];
       }]);
   </script>
   <div ng-controller="ExampleController">
     <div ng-repeat="innerList in list" ng-init="outerIndex = $index">
       <div ng-repeat="value in innerList" ng-init="innerIndex = $index">
          <span class="example-init">list[ {{outerIndex}} ][ {{innerIndex}} ] = {{value}};</span>
       </div>
     </div>
   </div>
     </file>
     <file name="protractor.js" type="protractor">
       it('should alias index positions', function() {
         var elements = element.all(by.css('.example-init'));
         expect(elements.get(0).getText()).toBe('list[ 0 ][ 0 ] = a;');
         expect(elements.get(1).getText()).toBe('list[ 0 ][ 1 ] = b;');
         expect(elements.get(2).getText()).toBe('list[ 1 ][ 0 ] = c;');
         expect(elements.get(3).getText()).toBe('list[ 1 ][ 1 ] = d;');
       });
     </file>
   </example>
 */
var ngInitDirective = ngDirective({
  priority: 450,
  compile: function() {
    return {
      pre: function(scope, element, attrs) {
        scope.$eval(attrs.ngInit);
      }
    };
  }
});

/**
 * @ngdoc directive
 * @name ngList
 * @restrict A
 * @priority 100
 *
 * @param {string=} ngList optional delimiter that should be used to split the value.
 *
 * @description
 * Text input that converts between a delimited string and an array of strings. The default
 * delimiter is a comma followed by a space - equivalent to `ng-list=", "`. You can specify a custom
 * delimiter as the value of the `ngList` attribute - for example, `ng-list=" | "`.
 *
 * The behaviour of the directive is affected by the use of the `ngTrim` attribute.
 * * If `ngTrim` is set to `"false"` then whitespace around both the separator and each
 *   list item is respected. This implies that the user of the directive is responsible for
 *   dealing with whitespace but also allows you to use whitespace as a delimiter, such as a
 *   tab or newline character.
 * * Otherwise whitespace around the delimiter is ignored when splitting (although it is respected
 *   when joining the list items back together) and whitespace around each list item is stripped
 *   before it is added to the model.
 *
 * @example
 * ### Validation
 *
 * <example name="ngList-directive" module="listExample">
 *   <file name="app.js">
 *      angular.module('listExample', [])
 *        .controller('ExampleController', ['$scope', function($scope) {
 *          $scope.names = ['morpheus', 'neo', 'trinity'];
 *        }]);
 *   </file>
 *   <file name="index.html">
 *    <form name="myForm" ng-controller="ExampleController">
 *      <label>List: <input name="namesInput" ng-model="names" ng-list required></label>
 *      <span role="alert">
 *        <span class="error" ng-show="myForm.namesInput.$error.required">
 *        Required!</span>
 *      </span>
 *      <br>
 *      <tt>names = {{names}}</tt><br/>
 *      <tt>myForm.namesInput.$valid = {{myForm.namesInput.$valid}}</tt><br/>
 *      <tt>myForm.namesInput.$error = {{myForm.namesInput.$error}}</tt><br/>
 *      <tt>myForm.$valid = {{myForm.$valid}}</tt><br/>
 *      <tt>myForm.$error.required = {{!!myForm.$error.required}}</tt><br/>
 *     </form>
 *   </file>
 *   <file name="protractor.js" type="protractor">
 *     var listInput = element(by.model('names'));
 *     var names = element(by.exactBinding('names'));
 *     var valid = element(by.binding('myForm.namesInput.$valid'));
 *     var error = element(by.css('span.error'));
 *
 *     it('should initialize to model', function() {
 *       expect(names.getText()).toContain('["morpheus","neo","trinity"]');
 *       expect(valid.getText()).toContain('true');
 *       expect(error.getCssValue('display')).toBe('none');
 *     });
 *
 *     it('should be invalid if empty', function() {
 *       listInput.clear();
 *       listInput.sendKeys('');
 *
 *       expect(names.getText()).toContain('');
 *       expect(valid.getText()).toContain('false');
 *       expect(error.getCssValue('display')).not.toBe('none');
 *     });
 *   </file>
 * </example>
 *
 * @example
 * ### Splitting on newline
 *
 * <example name="ngList-directive-newlines">
 *   <file name="index.html">
 *    <textarea ng-model="list" ng-list="&#10;" ng-trim="false"></textarea>
 *    <pre>{{ list | json }}</pre>
 *   </file>
 *   <file name="protractor.js" type="protractor">
 *     it("should split the text by newlines", function() {
 *       var listInput = element(by.model('list'));
 *       var output = element(by.binding('list | json'));
 *       listInput.sendKeys('abc\ndef\nghi');
 *       expect(output.getText()).toContain('[\n  "abc",\n  "def",\n  "ghi"\n]');
 *     });
 *   </file>
 * </example>
 *
 */
var ngListDirective = function() {
  return {
    restrict: 'A',
    priority: 100,
    require: 'ngModel',
    link: function(scope, element, attr, ctrl) {
      var ngList = attr.ngList || ', ';
      var trimValues = attr.ngTrim !== 'false';
      var separator = trimValues ? trim(ngList) : ngList;

      var parse = function(viewValue) {
        // If the viewValue is invalid (say required but empty) it will be `undefined`
        if (isUndefined(viewValue)) return;

        var list = [];

        if (viewValue) {
          forEach(viewValue.split(separator), function(value) {
            if (value) list.push(trimValues ? trim(value) : value);
          });
        }

        return list;
      };

      ctrl.$parsers.push(parse);
      ctrl.$formatters.push(function(value) {
        if (isArray(value)) {
          return value.join(ngList);
        }

        return undefined;
      });

      // Override the standard $isEmpty because an empty array means the input is empty.
      ctrl.$isEmpty = function(value) {
        return !value || !value.length;
      };
    }
  };
};

/* global VALID_CLASS: true,
  INVALID_CLASS: true,
  PRISTINE_CLASS: true,
  DIRTY_CLASS: true,
  UNTOUCHED_CLASS: true,
  TOUCHED_CLASS: true,
  PENDING_CLASS: true,
  addSetValidityMethod: true,
  setupValidity: true,
  defaultModelOptions: false
*/


var VALID_CLASS = 'ng-valid',
    INVALID_CLASS = 'ng-invalid',
    PRISTINE_CLASS = 'ng-pristine',
    DIRTY_CLASS = 'ng-dirty',
    UNTOUCHED_CLASS = 'ng-untouched',
    TOUCHED_CLASS = 'ng-touched',
    EMPTY_CLASS = 'ng-empty',
    NOT_EMPTY_CLASS = 'ng-not-empty';

var ngModelMinErr = minErr('ngModel');

/**
 * @ngdoc type
 * @name ngModel.NgModelController
 * @property {*} $viewValue The actual value from the control's view. For `input` elements, this is a
 * String. See {@link ngModel.NgModelController#$setViewValue} for information about when the $viewValue
 * is set.
 *
 * @property {*} $modelValue The value in the model that the control is bound to.
 *
 * @property {Array.<Function>} $parsers Array of functions to execute, as a pipeline, whenever
 *  the control updates the ngModelController with a new {@link ngModel.NgModelController#$viewValue
    `$viewValue`} from the DOM, usually via user input.
    See {@link ngModel.NgModelController#$setViewValue `$setViewValue()`} for a detailed lifecycle explanation.
    Note that the `$parsers` are not called when the bound ngModel expression changes programmatically.

  The functions are called in array order, each passing
    its return value through to the next. The last return value is forwarded to the
    {@link ngModel.NgModelController#$validators `$validators`} collection.

  Parsers are used to sanitize / convert the {@link ngModel.NgModelController#$viewValue
    `$viewValue`}.

  Returning `undefined` from a parser means a parse error occurred. In that case,
    no {@link ngModel.NgModelController#$validators `$validators`} will run and the `ngModel`
    will be set to `undefined` unless {@link ngModelOptions `ngModelOptions.allowInvalid`}
    is set to `true`. The parse error is stored in `ngModel.$error.parse`.

  This simple example shows a parser that would convert text input value to lowercase:
 * ```js
 * function parse(value) {
 *   if (value) {
 *     return value.toLowerCase();
 *   }
 * }
 * ngModelController.$parsers.push(parse);
 * ```

 *
 * @property {Array.<Function>} $formatters Array of functions to execute, as a pipeline, whenever
    the bound ngModel expression changes programmatically. The `$formatters` are not called when the
    value of the control is changed by user interaction.

  Formatters are used to format / convert the {@link ngModel.NgModelController#$modelValue
    `$modelValue`} for display in the control.

  The functions are called in reverse array order, each passing the value through to the
    next. The last return value is used as the actual DOM value.

  This simple example shows a formatter that would convert the model value to uppercase:

 * ```js
 * function format(value) {
 *   if (value) {
 *     return value.toUpperCase();
 *   }
 * }
 * ngModel.$formatters.push(format);
 * ```
 *
 * @property {Object.<string, function>} $validators A collection of validators that are applied
 *      whenever the model value changes. The key value within the object refers to the name of the
 *      validator while the function refers to the validation operation. The validation operation is
 *      provided with the model value as an argument and must return a true or false value depending
 *      on the response of that validation.
 *
 * ```js
 * ngModel.$validators.validCharacters = function(modelValue, viewValue) {
 *   var value = modelValue || viewValue;
 *   return /[0-9]+/.test(value) &&
 *          /[a-z]+/.test(value) &&
 *          /[A-Z]+/.test(value) &&
 *          /\W+/.test(value);
 * };
 * ```
 *
 * @property {Object.<string, function>} $asyncValidators A collection of validations that are expected to
 *      perform an asynchronous validation (e.g. a HTTP request). The validation function that is provided
 *      is expected to return a promise when it is run during the model validation process. Once the promise
 *      is delivered then the validation status will be set to true when fulfilled and false when rejected.
 *      When the asynchronous validators are triggered, each of the validators will run in parallel and the model
 *      value will only be updated once all validators have been fulfilled. As long as an asynchronous validator
 *      is unfulfilled, its key will be added to the controllers `$pending` property. Also, all asynchronous validators
 *      will only run once all synchronous validators have passed.
 *
 * Please note that if $http is used then it is important that the server returns a success HTTP response code
 * in order to fulfill the validation and a status level of `4xx` in order to reject the validation.
 *
 * ```js
 * ngModel.$asyncValidators.uniqueUsername = function(modelValue, viewValue) {
 *   var value = modelValue || viewValue;
 *
 *   // Lookup user by username
 *   return $http.get('/api/users/' + value).
 *      then(function resolved() {
 *        //username exists, this means validation fails
 *        return $q.reject('exists');
 *      }, function rejected() {
 *        //username does not exist, therefore this validation passes
 *        return true;
 *      });
 * };
 * ```
 *
 * @property {Array.<Function>} $viewChangeListeners Array of functions to execute whenever
 *     a change to {@link ngModel.NgModelController#$viewValue `$viewValue`} has caused a change
 *     to {@link ngModel.NgModelController#$modelValue `$modelValue`}.
 *     It is called with no arguments, and its return value is ignored.
 *     This can be used in place of additional $watches against the model value.
 *
 * @property {Object} $error An object hash with all failing validator ids as keys.
 * @property {Object} $pending An object hash with all pending validator ids as keys.
 *
 * @property {boolean} $untouched True if control has not lost focus yet.
 * @property {boolean} $touched True if control has lost focus.
 * @property {boolean} $pristine True if user has not interacted with the control yet.
 * @property {boolean} $dirty True if user has already interacted with the control.
 * @property {boolean} $valid True if there is no error.
 * @property {boolean} $invalid True if at least one error on the control.
 * @property {string} $name The name attribute of the control.
 *
 * @description
 *
 * `NgModelController` provides API for the {@link ngModel `ngModel`} directive.
 * The controller contains services for data-binding, validation, CSS updates, and value formatting
 * and parsing. It purposefully does not contain any logic which deals with DOM rendering or
 * listening to DOM events.
 * Such DOM related logic should be provided by other directives which make use of
 * `NgModelController` for data-binding to control elements.
 * AngularJS provides this DOM logic for most {@link input `input`} elements.
 * At the end of this page you can find a {@link ngModel.NgModelController#custom-control-example
 * custom control example} that uses `ngModelController` to bind to `contenteditable` elements.
 *
 * @example
 * ### Custom Control Example
 * This example shows how to use `NgModelController` with a custom control to achieve
 * data-binding. Notice how different directives (`contenteditable`, `ng-model`, and `required`)
 * collaborate together to achieve the desired result.
 *
 * `contenteditable` is an HTML5 attribute, which tells the browser to let the element
 * contents be edited in place by the user.
 *
 * We are using the {@link ng.service:$sce $sce} service here and include the {@link ngSanitize $sanitize}
 * module to automatically remove "bad" content like inline event listener (e.g. `<span onclick="...">`).
 * However, as we are using `$sce` the model can still decide to provide unsafe content if it marks
 * that content using the `$sce` service.
 *
 * <example name="NgModelController" module="customControl" deps="angular-sanitize.js">
    <file name="style.css">
      [contenteditable] {
        border: 1px solid black;
        background-color: white;
        min-height: 20px;
      }

      .ng-invalid {
        border: 1px solid red;
      }

    </file>
    <file name="script.js">
      angular.module('customControl', ['ngSanitize']).
        directive('contenteditable', ['$sce', function($sce) {
          return {
            restrict: 'A', // only activate on element attribute
            require: '?ngModel', // get a hold of NgModelController
            link: function(scope, element, attrs, ngModel) {
              if (!ngModel) return; // do nothing if no ng-model

              // Specify how UI should be updated
              ngModel.$render = function() {
                element.html($sce.getTrustedHtml(ngModel.$viewValue || ''));
              };

              // Listen for change events to enable binding
              element.on('blur keyup change', function() {
                scope.$evalAsync(read);
              });
              read(); // initialize

              // Write data to the model
              function read() {
                var html = element.html();
                // When we clear the content editable the browser leaves a <br> behind
                // If strip-br attribute is provided then we strip this out
                if (attrs.stripBr && html === '<br>') {
                  html = '';
                }
                ngModel.$setViewValue(html);
              }
            }
          };
        }]);
    </file>
    <file name="index.html">
      <form name="myForm">
       <div contenteditable
            name="myWidget" ng-model="userContent"
            strip-br="true"
            required>Change me!</div>
        <span ng-show="myForm.myWidget.$error.required">Required!</span>
       <hr>
       <textarea ng-model="userContent" aria-label="Dynamic textarea"></textarea>
      </form>
    </file>
    <file name="protractor.js" type="protractor">
    it('should data-bind and become invalid', function() {
      if (browser.params.browser === 'safari' || browser.params.browser === 'firefox') {
        // SafariDriver can't handle contenteditable
        // and Firefox driver can't clear contenteditables very well
        return;
      }
      var contentEditable = element(by.css('[contenteditable]'));
      var content = 'Change me!';

      expect(contentEditable.getText()).toEqual(content);

      contentEditable.clear();
      contentEditable.sendKeys(protractor.Key.BACK_SPACE);
      expect(contentEditable.getText()).toEqual('');
      expect(contentEditable.getAttribute('class')).toMatch(/ng-invalid-required/);
    });
    </file>
 * </example>
 *
 *
 */
NgModelController.$inject = ['$scope', '$exceptionHandler', '$attrs', '$element', '$parse', '$animate', '$timeout', '$q', '$interpolate'];
function NgModelController($scope, $exceptionHandler, $attr, $element, $parse, $animate, $timeout, $q, $interpolate) {
  this.$viewValue = Number.NaN;
  this.$modelValue = Number.NaN;
  this.$$rawModelValue = undefined; // stores the parsed modelValue / model set from scope regardless of validity.
  this.$validators = {};
  this.$asyncValidators = {};
  this.$parsers = [];
  this.$formatters = [];
  this.$viewChangeListeners = [];
  this.$untouched = true;
  this.$touched = false;
  this.$pristine = true;
  this.$dirty = false;
  this.$valid = true;
  this.$invalid = false;
  this.$error = {}; // keep invalid keys here
  this.$$success = {}; // keep valid keys here
  this.$pending = undefined; // keep pending keys here
  this.$name = $interpolate($attr.name || '', false)($scope);
  this.$$parentForm = nullFormCtrl;
  this.$options = defaultModelOptions;
  this.$$updateEvents = '';
  // Attach the correct context to the event handler function for updateOn
  this.$$updateEventHandler = this.$$updateEventHandler.bind(this);

  this.$$parsedNgModel = $parse($attr.ngModel);
  this.$$parsedNgModelAssign = this.$$parsedNgModel.assign;
  this.$$ngModelGet = this.$$parsedNgModel;
  this.$$ngModelSet = this.$$parsedNgModelAssign;
  this.$$pendingDebounce = null;
  this.$$parserValid = undefined;

  this.$$currentValidationRunId = 0;

  // https://github.com/angular/angular.js/issues/15833
  // Prevent `$$scope` from being iterated over by `copy` when NgModelController is deep watched
  Object.defineProperty(this, '$$scope', {value: $scope});
  this.$$attr = $attr;
  this.$$element = $element;
  this.$$animate = $animate;
  this.$$timeout = $timeout;
  this.$$parse = $parse;
  this.$$q = $q;
  this.$$exceptionHandler = $exceptionHandler;

  setupValidity(this);
  setupModelWatcher(this);
}

NgModelController.prototype = {
  $$initGetterSetters: function() {
    if (this.$options.getOption('getterSetter')) {
      var invokeModelGetter = this.$$parse(this.$$attr.ngModel + '()'),
          invokeModelSetter = this.$$parse(this.$$attr.ngModel + '($$$p)');

      this.$$ngModelGet = function($scope) {
        var modelValue = this.$$parsedNgModel($scope);
        if (isFunction(modelValue)) {
          modelValue = invokeModelGetter($scope);
        }
        return modelValue;
      };
      this.$$ngModelSet = function($scope, newValue) {
        if (isFunction(this.$$parsedNgModel($scope))) {
          invokeModelSetter($scope, {$$$p: newValue});
        } else {
          this.$$parsedNgModelAssign($scope, newValue);
        }
      };
    } else if (!this.$$parsedNgModel.assign) {
      throw ngModelMinErr('nonassign', 'Expression \'{0}\' is non-assignable. Element: {1}',
          this.$$attr.ngModel, startingTag(this.$$element));
    }
  },


  /**
   * @ngdoc method
   * @name ngModel.NgModelController#$render
   *
   * @description
   * Called when the view needs to be updated. It is expected that the user of the ng-model
   * directive will implement this method.
   *
   * The `$render()` method is invoked in the following situations:
   *
   * * `$rollbackViewValue()` is called.  If we are rolling back the view value to the last
   *   committed value then `$render()` is called to update the input control.
   * * The value referenced by `ng-model` is changed programmatically and both the `$modelValue` and
   *   the `$viewValue` are different from last time.
   *
   * Since `ng-model` does not do a deep watch, `$render()` is only invoked if the values of
   * `$modelValue` and `$viewValue` are actually different from their previous values. If `$modelValue`
   * or `$viewValue` are objects (rather than a string or number) then `$render()` will not be
   * invoked if you only change a property on the objects.
   */
  $render: noop,

  /**
   * @ngdoc method
   * @name ngModel.NgModelController#$isEmpty
   *
   * @description
   * This is called when we need to determine if the value of an input is empty.
   *
   * For instance, the required directive does this to work out if the input has data or not.
   *
   * The default `$isEmpty` function checks whether the value is `undefined`, `''`, `null` or `NaN`.
   *
   * You can override this for input directives whose concept of being empty is different from the
   * default. The `checkboxInputType` directive does this because in its case a value of `false`
   * implies empty.
   *
   * @param {*} value The value of the input to check for emptiness.
   * @returns {boolean} True if `value` is "empty".
   */
  $isEmpty: function(value) {
    // eslint-disable-next-line no-self-compare
    return isUndefined(value) || value === '' || value === null || value !== value;
  },

  $$updateEmptyClasses: function(value) {
    if (this.$isEmpty(value)) {
      this.$$animate.removeClass(this.$$element, NOT_EMPTY_CLASS);
      this.$$animate.addClass(this.$$element, EMPTY_CLASS);
    } else {
      this.$$animate.removeClass(this.$$element, EMPTY_CLASS);
      this.$$animate.addClass(this.$$element, NOT_EMPTY_CLASS);
    }
  },

  /**
   * @ngdoc method
   * @name ngModel.NgModelController#$setPristine
   *
   * @description
   * Sets the control to its pristine state.
   *
   * This method can be called to remove the `ng-dirty` class and set the control to its pristine
   * state (`ng-pristine` class). A model is considered to be pristine when the control
   * has not been changed from when first compiled.
   */
  $setPristine: function() {
    this.$dirty = false;
    this.$pristine = true;
    this.$$animate.removeClass(this.$$element, DIRTY_CLASS);
    this.$$animate.addClass(this.$$element, PRISTINE_CLASS);
  },

  /**
   * @ngdoc method
   * @name ngModel.NgModelController#$setDirty
   *
   * @description
   * Sets the control to its dirty state.
   *
   * This method can be called to remove the `ng-pristine` class and set the control to its dirty
   * state (`ng-dirty` class). A model is considered to be dirty when the control has been changed
   * from when first compiled.
   */
  $setDirty: function() {
    this.$dirty = true;
    this.$pristine = false;
    this.$$animate.removeClass(this.$$element, PRISTINE_CLASS);
    this.$$animate.addClass(this.$$element, DIRTY_CLASS);
    this.$$parentForm.$setDirty();
  },

  /**
   * @ngdoc method
   * @name ngModel.NgModelController#$setUntouched
   *
   * @description
   * Sets the control to its untouched state.
   *
   * This method can be called to remove the `ng-touched` class and set the control to its
   * untouched state (`ng-untouched` class). Upon compilation, a model is set as untouched
   * by default, however this function can be used to restore that state if the model has
   * already been touched by the user.
   */
  $setUntouched: function() {
    this.$touched = false;
    this.$untouched = true;
    this.$$animate.setClass(this.$$element, UNTOUCHED_CLASS, TOUCHED_CLASS);
  },

  /**
   * @ngdoc method
   * @name ngModel.NgModelController#$setTouched
   *
   * @description
   * Sets the control to its touched state.
   *
   * This method can be called to remove the `ng-untouched` class and set the control to its
   * touched state (`ng-touched` class). A model is considered to be touched when the user has
   * first focused the control element and then shifted focus away from the control (blur event).
   */
  $setTouched: function() {
    this.$touched = true;
    this.$untouched = false;
    this.$$animate.setClass(this.$$element, TOUCHED_CLASS, UNTOUCHED_CLASS);
  },

  /**
   * @ngdoc method
   * @name ngModel.NgModelController#$rollbackViewValue
   *
   * @description
   * Cancel an update and reset the input element's value to prevent an update to the `$modelValue`,
   * which may be caused by a pending debounced event or because the input is waiting for some
   * future event.
   *
   * If you have an input that uses `ng-model-options` to set up debounced updates or updates that
   * depend on special events such as `blur`, there can be a period when the `$viewValue` is out of
   * sync with the ngModel's `$modelValue`.
   *
   * In this case, you can use `$rollbackViewValue()` to manually cancel the debounced / future update
   * and reset the input to the last committed view value.
   *
   * It is also possible that you run into difficulties if you try to update the ngModel's `$modelValue`
   * programmatically before these debounced/future events have resolved/occurred, because AngularJS's
   * dirty checking mechanism is not able to tell whether the model has actually changed or not.
   *
   * The `$rollbackViewValue()` method should be called before programmatically changing the model of an
   * input which may have such events pending. This is important in order to make sure that the
   * input field will be updated with the new model value and any pending operations are cancelled.
   *
   * @example
   * <example name="ng-model-cancel-update" module="cancel-update-example">
   *   <file name="app.js">
   *     angular.module('cancel-update-example', [])
   *
   *     .controller('CancelUpdateController', ['$scope', function($scope) {
   *       $scope.model = {value1: '', value2: ''};
   *
   *       $scope.setEmpty = function(e, value, rollback) {
   *         if (e.keyCode === 27) {
   *           e.preventDefault();
   *           if (rollback) {
   *             $scope.myForm[value].$rollbackViewValue();
   *           }
   *           $scope.model[value] = '';
   *         }
   *       };
   *     }]);
   *   </file>
   *   <file name="index.html">
   *     <div ng-controller="CancelUpdateController">
   *       <p>Both of these inputs are only updated if they are blurred. Hitting escape should
   *       empty them. Follow these steps and observe the difference:</p>
   *       <ol>
   *         <li>Type something in the input. You will see that the model is not yet updated</li>
   *         <li>Press the Escape key.
   *           <ol>
   *             <li> In the first example, nothing happens, because the model is already '', and no
   *             update is detected. If you blur the input, the model will be set to the current view.
   *             </li>
   *             <li> In the second example, the pending update is cancelled, and the input is set back
   *             to the last committed view value (''). Blurring the input does nothing.
   *             </li>
   *           </ol>
   *         </li>
   *       </ol>
   *
   *       <form name="myForm" ng-model-options="{ updateOn: 'blur' }">
   *         <div>
   *           <p id="inputDescription1">Without $rollbackViewValue():</p>
   *           <input name="value1" aria-describedby="inputDescription1" ng-model="model.value1"
   *                  ng-keydown="setEmpty($event, 'value1')">
   *           value1: "{{ model.value1 }}"
   *         </div>
   *
   *         <div>
   *           <p id="inputDescription2">With $rollbackViewValue():</p>
   *           <input name="value2" aria-describedby="inputDescription2" ng-model="model.value2"
   *                  ng-keydown="setEmpty($event, 'value2', true)">
   *           value2: "{{ model.value2 }}"
   *         </div>
   *       </form>
   *     </div>
   *   </file>
       <file name="style.css">
          div {
            display: table-cell;
          }
          div:nth-child(1) {
            padding-right: 30px;
          }

        </file>
   * </example>
   */
  $rollbackViewValue: function() {
    this.$$timeout.cancel(this.$$pendingDebounce);
    this.$viewValue = this.$$lastCommittedViewValue;
    this.$render();
  },

  /**
   * @ngdoc method
   * @name ngModel.NgModelController#$validate
   *
   * @description
   * Runs each of the registered validators (first synchronous validators and then
   * asynchronous validators).
   * If the validity changes to invalid, the model will be set to `undefined`,
   * unless {@link ngModelOptions `ngModelOptions.allowInvalid`} is `true`.
   * If the validity changes to valid, it will set the model to the last available valid
   * `$modelValue`, i.e. either the last parsed value or the last value set from the scope.
   */
  $validate: function() {
    // ignore $validate before model is initialized
    if (isNumberNaN(this.$modelValue)) {
      return;
    }

    var viewValue = this.$$lastCommittedViewValue;
    // Note: we use the $$rawModelValue as $modelValue might have been
    // set to undefined during a view -> model update that found validation
    // errors. We can't parse the view here, since that could change
    // the model although neither viewValue nor the model on the scope changed
    var modelValue = this.$$rawModelValue;

    var prevValid = this.$valid;
    var prevModelValue = this.$modelValue;

    var allowInvalid = this.$options.getOption('allowInvalid');

    var that = this;
    this.$$runValidators(modelValue, viewValue, function(allValid) {
      // If there was no change in validity, don't update the model
      // This prevents changing an invalid modelValue to undefined
      if (!allowInvalid && prevValid !== allValid) {
        // Note: Don't check this.$valid here, as we could have
        // external validators (e.g. calculated on the server),
        // that just call $setValidity and need the model value
        // to calculate their validity.
        that.$modelValue = allValid ? modelValue : undefined;

        if (that.$modelValue !== prevModelValue) {
          that.$$writeModelToScope();
        }
      }
    });
  },

  $$runValidators: function(modelValue, viewValue, doneCallback) {
    this.$$currentValidationRunId++;
    var localValidationRunId = this.$$currentValidationRunId;
    var that = this;

    // check parser error
    if (!processParseErrors()) {
      validationDone(false);
      return;
    }
    if (!processSyncValidators()) {
      validationDone(false);
      return;
    }
    processAsyncValidators();

    function processParseErrors() {
      var errorKey = that.$$parserName || 'parse';
      if (isUndefined(that.$$parserValid)) {
        setValidity(errorKey, null);
      } else {
        if (!that.$$parserValid) {
          forEach(that.$validators, function(v, name) {
            setValidity(name, null);
          });
          forEach(that.$asyncValidators, function(v, name) {
            setValidity(name, null);
          });
        }
        // Set the parse error last, to prevent unsetting it, should a $validators key == parserName
        setValidity(errorKey, that.$$parserValid);
        return that.$$parserValid;
      }
      return true;
    }

    function processSyncValidators() {
      var syncValidatorsValid = true;
      forEach(that.$validators, function(validator, name) {
        var result = Boolean(validator(modelValue, viewValue));
        syncValidatorsValid = syncValidatorsValid && result;
        setValidity(name, result);
      });
      if (!syncValidatorsValid) {
        forEach(that.$asyncValidators, function(v, name) {
          setValidity(name, null);
        });
        return false;
      }
      return true;
    }

    function processAsyncValidators() {
      var validatorPromises = [];
      var allValid = true;
      forEach(that.$asyncValidators, function(validator, name) {
        var promise = validator(modelValue, viewValue);
        if (!isPromiseLike(promise)) {
          throw ngModelMinErr('nopromise',
            'Expected asynchronous validator to return a promise but got \'{0}\' instead.', promise);
        }
        setValidity(name, undefined);
        validatorPromises.push(promise.then(function() {
          setValidity(name, true);
        }, function() {
          allValid = false;
          setValidity(name, false);
        }));
      });
      if (!validatorPromises.length) {
        validationDone(true);
      } else {
        that.$$q.all(validatorPromises).then(function() {
          validationDone(allValid);
        }, noop);
      }
    }

    function setValidity(name, isValid) {
      if (localValidationRunId === that.$$currentValidationRunId) {
        that.$setValidity(name, isValid);
      }
    }

    function validationDone(allValid) {
      if (localValidationRunId === that.$$currentValidationRunId) {

        doneCallback(allValid);
      }
    }
  },

  /**
   * @ngdoc method
   * @name ngModel.NgModelController#$commitViewValue
   *
   * @description
   * Commit a pending update to the `$modelValue`.
   *
   * Updates may be pending by a debounced event or because the input is waiting for a some future
   * event defined in `ng-model-options`. this method is rarely needed as `NgModelController`
   * usually handles calling this in response to input events.
   */
  $commitViewValue: function() {
    var viewValue = this.$viewValue;

    this.$$timeout.cancel(this.$$pendingDebounce);

    // If the view value has not changed then we should just exit, except in the case where there is
    // a native validator on the element. In this case the validation state may have changed even though
    // the viewValue has stayed empty.
    if (this.$$lastCommittedViewValue === viewValue && (viewValue !== '' || !this.$$hasNativeValidators)) {
      return;
    }
    this.$$updateEmptyClasses(viewValue);
    this.$$lastCommittedViewValue = viewValue;

    // change to dirty
    if (this.$pristine) {
      this.$setDirty();
    }
    this.$$parseAndValidate();
  },

  $$parseAndValidate: function() {
    var viewValue = this.$$lastCommittedViewValue;
    var modelValue = viewValue;
    var that = this;

    this.$$parserValid = isUndefined(modelValue) ? undefined : true;

    if (this.$$parserValid) {
      for (var i = 0; i < this.$parsers.length; i++) {
        modelValue = this.$parsers[i](modelValue);
        if (isUndefined(modelValue)) {
          this.$$parserValid = false;
          break;
        }
      }
    }
    if (isNumberNaN(this.$modelValue)) {
      // this.$modelValue has not been touched yet...
      this.$modelValue = this.$$ngModelGet(this.$$scope);
    }
    var prevModelValue = this.$modelValue;
    var allowInvalid = this.$options.getOption('allowInvalid');
    this.$$rawModelValue = modelValue;

    if (allowInvalid) {
      this.$modelValue = modelValue;
      writeToModelIfNeeded();
    }

    // Pass the $$lastCommittedViewValue here, because the cached viewValue might be out of date.
    // This can happen if e.g. $setViewValue is called from inside a parser
    this.$$runValidators(modelValue, this.$$lastCommittedViewValue, function(allValid) {
      if (!allowInvalid) {
        // Note: Don't check this.$valid here, as we could have
        // external validators (e.g. calculated on the server),
        // that just call $setValidity and need the model value
        // to calculate their validity.
        that.$modelValue = allValid ? modelValue : undefined;
        writeToModelIfNeeded();
      }
    });

    function writeToModelIfNeeded() {
      if (that.$modelValue !== prevModelValue) {
        that.$$writeModelToScope();
      }
    }
  },

  $$writeModelToScope: function() {
    this.$$ngModelSet(this.$$scope, this.$modelValue);
    forEach(this.$viewChangeListeners, function(listener) {
      try {
        listener();
      } catch (e) {
        // eslint-disable-next-line no-invalid-this
        this.$$exceptionHandler(e);
      }
    }, this);
  },

  /**
   * @ngdoc method
   * @name ngModel.NgModelController#$setViewValue
   *
   * @description
   * Update the view value.
   *
   * This method should be called when a control wants to change the view value; typically,
   * this is done from within a DOM event handler. For example, the {@link ng.directive:input input}
   * directive calls it when the value of the input changes and {@link ng.directive:select select}
   * calls it when an option is selected.
   *
   * When `$setViewValue` is called, the new `value` will be staged for committing through the `$parsers`
   * and `$validators` pipelines. If there are no special {@link ngModelOptions} specified then the staged
   * value is sent directly for processing through the `$parsers` pipeline. After this, the `$validators` and
   * `$asyncValidators` are called and the value is applied to `$modelValue`.
   * Finally, the value is set to the **expression** specified in the `ng-model` attribute and
   * all the registered change listeners, in the `$viewChangeListeners` list are called.
   *
   * In case the {@link ng.directive:ngModelOptions ngModelOptions} directive is used with `updateOn`
   * and the `default` trigger is not listed, all those actions will remain pending until one of the
   * `updateOn` events is triggered on the DOM element.
   * All these actions will be debounced if the {@link ng.directive:ngModelOptions ngModelOptions}
   * directive is used with a custom debounce for this particular event.
   * Note that a `$digest` is only triggered once the `updateOn` events are fired, or if `debounce`
   * is specified, once the timer runs out.
   *
   * When used with standard inputs, the view value will always be a string (which is in some cases
   * parsed into another type, such as a `Date` object for `input[date]`.)
   * However, custom controls might also pass objects to this method. In this case, we should make
   * a copy of the object before passing it to `$setViewValue`. This is because `ngModel` does not
   * perform a deep watch of objects, it only looks for a change of identity. If you only change
   * the property of the object then ngModel will not realize that the object has changed and
   * will not invoke the `$parsers` and `$validators` pipelines. For this reason, you should
   * not change properties of the copy once it has been passed to `$setViewValue`.
   * Otherwise you may cause the model value on the scope to change incorrectly.
   *
   * <div class="alert alert-info">
   * In any case, the value passed to the method should always reflect the current value
   * of the control. For example, if you are calling `$setViewValue` for an input element,
   * you should pass the input DOM value. Otherwise, the control and the scope model become
   * out of sync. It's also important to note that `$setViewValue` does not call `$render` or change
   * the control's DOM value in any way. If we want to change the control's DOM value
   * programmatically, we should update the `ngModel` scope expression. Its new value will be
   * picked up by the model controller, which will run it through the `$formatters`, `$render` it
   * to update the DOM, and finally call `$validate` on it.
   * </div>
   *
   * @param {*} value value from the view.
   * @param {string} trigger Event that triggered the update.
   */
  $setViewValue: function(value, trigger) {
    this.$viewValue = value;
    if (this.$options.getOption('updateOnDefault')) {
      this.$$debounceViewValueCommit(trigger);
    }
  },

  $$debounceViewValueCommit: function(trigger) {
    var debounceDelay = this.$options.getOption('debounce');

    if (isNumber(debounceDelay[trigger])) {
      debounceDelay = debounceDelay[trigger];
    } else if (isNumber(debounceDelay['default'])) {
      debounceDelay = debounceDelay['default'];
    }

    this.$$timeout.cancel(this.$$pendingDebounce);
    var that = this;
    if (debounceDelay > 0) { // this fails if debounceDelay is an object
      this.$$pendingDebounce = this.$$timeout(function() {
        that.$commitViewValue();
      }, debounceDelay);
    } else if (this.$$scope.$root.$$phase) {
      this.$commitViewValue();
    } else {
      this.$$scope.$apply(function() {
        that.$commitViewValue();
      });
    }
  },

  /**
   * @ngdoc method
   *
   * @name ngModel.NgModelController#$overrideModelOptions
   *
   * @description
   *
   * Override the current model options settings programmatically.
   *
   * The previous `ModelOptions` value will not be modified. Instead, a
   * new `ModelOptions` object will inherit from the previous one overriding
   * or inheriting settings that are defined in the given parameter.
   *
   * See {@link ngModelOptions} for information about what options can be specified
   * and how model option inheritance works.
   *
   * <div class="alert alert-warning">
   * **Note:** this function only affects the options set on the `ngModelController`,
   * and not the options on the {@link ngModelOptions} directive from which they might have been
   * obtained initially.
   * </div>
   *
   * <div class="alert alert-danger">
   * **Note:** it is not possible to override the `getterSetter` option.
   * </div>
   *
   * @param {Object} options a hash of settings to override the previous options
   *
   */
  $overrideModelOptions: function(options) {
    this.$options = this.$options.createChild(options);
    this.$$setUpdateOnEvents();
  },

  /**
   * @ngdoc method
   *
   * @name  ngModel.NgModelController#$processModelValue

   * @description
   *
   * Runs the model -> view pipeline on the current
   * {@link ngModel.NgModelController#$modelValue $modelValue}.
   *
   * The following actions are performed by this method:
   *
   * - the `$modelValue` is run through the {@link ngModel.NgModelController#$formatters $formatters}
   * and the result is set to the {@link ngModel.NgModelController#$viewValue $viewValue}
   * - the `ng-empty` or `ng-not-empty` class is set on the element
   * - if the `$viewValue` has changed:
   *   - {@link ngModel.NgModelController#$render $render} is called on the control
   *   - the {@link ngModel.NgModelController#$validators $validators} are run and
   *   the validation status is set.
   *
   * This method is called by ngModel internally when the bound scope value changes.
   * Application developers usually do not have to call this function themselves.
   *
   * This function can be used when the `$viewValue` or the rendered DOM value are not correctly
   * formatted and the `$modelValue` must be run through the `$formatters` again.
   *
   * @example
   * Consider a text input with an autocomplete list (for fruit), where the items are
   * objects with a name and an id.
   * A user enters `ap` and then selects `Apricot` from the list.
   * Based on this, the autocomplete widget will call `$setViewValue({name: 'Apricot', id: 443})`,
   * but the rendered value will still be `ap`.
   * The widget can then call `ctrl.$processModelValue()` to run the model -> view
   * pipeline again, which formats the object to the string `Apricot`,
   * then updates the `$viewValue`, and finally renders it in the DOM.
   *
   * <example module="inputExample" name="ng-model-process">
     <file name="index.html">
      <div ng-controller="inputController" style="display: flex;">
        <div style="margin-right: 30px;">
          Search Fruit:
          <basic-autocomplete items="items" on-select="selectedFruit = item"></basic-autocomplete>
        </div>
        <div>
          Model:<br>
          <pre>{{selectedFruit | json}}</pre>
        </div>
      </div>
     </file>
     <file name="app.js">
      angular.module('inputExample', [])
        .controller('inputController', function($scope) {
          $scope.items = [
            {name: 'Apricot', id: 443},
            {name: 'Clementine', id: 972},
            {name: 'Durian', id: 169},
            {name: 'Jackfruit', id: 982},
            {name: 'Strawberry', id: 863}
          ];
        })
        .component('basicAutocomplete', {
          bindings: {
            items: '<',
            onSelect: '&'
          },
          templateUrl: 'autocomplete.html',
          controller: function($element, $scope) {
            var that = this;
            var ngModel;

            that.$postLink = function() {
              ngModel = $element.find('input').controller('ngModel');

              ngModel.$formatters.push(function(value) {
                return (value && value.name) || value;
              });

              ngModel.$parsers.push(function(value) {
                var match = value;
                for (var i = 0; i < that.items.length; i++) {
                  if (that.items[i].name === value) {
                    match = that.items[i];
                    break;
                  }
                }

                return match;
              });
            };

            that.selectItem = function(item) {
              ngModel.$setViewValue(item);
              ngModel.$processModelValue();
              that.onSelect({item: item});
            };
          }
        });
     </file>
     <file name="autocomplete.html">
       <div>
         <input type="search" ng-model="$ctrl.searchTerm" />
         <ul>
           <li ng-repeat="item in $ctrl.items | filter:$ctrl.searchTerm">
             <button ng-click="$ctrl.selectItem(item)">{{ item.name }}</button>
           </li>
         </ul>
       </div>
     </file>
   * </example>
   *
   */
  $processModelValue: function() {
    var viewValue = this.$$format();

    if (this.$viewValue !== viewValue) {
      this.$$updateEmptyClasses(viewValue);
      this.$viewValue = this.$$lastCommittedViewValue = viewValue;
      this.$render();
      // It is possible that model and view value have been updated during render
      this.$$runValidators(this.$modelValue, this.$viewValue, noop);
    }
  },

  /**
   * This method is called internally to run the $formatters on the $modelValue
   */
  $$format: function() {
    var formatters = this.$formatters,
        idx = formatters.length;

    var viewValue = this.$modelValue;
    while (idx--) {
      viewValue = formatters[idx](viewValue);
    }

    return viewValue;
  },

  /**
   * This method is called internally when the bound scope value changes.
   */
  $$setModelValue: function(modelValue) {
    this.$modelValue = this.$$rawModelValue = modelValue;
    this.$$parserValid = undefined;
    this.$processModelValue();
  },

  $$setUpdateOnEvents: function() {
    if (this.$$updateEvents) {
      this.$$element.off(this.$$updateEvents, this.$$updateEventHandler);
    }

    this.$$updateEvents = this.$options.getOption('updateOn');
    if (this.$$updateEvents) {
      this.$$element.on(this.$$updateEvents, this.$$updateEventHandler);
    }
  },

  $$updateEventHandler: function(ev) {
    this.$$debounceViewValueCommit(ev && ev.type);
  }
};

function setupModelWatcher(ctrl) {
  // model -> value
  // Note: we cannot use a normal scope.$watch as we want to detect the following:
  // 1. scope value is 'a'
  // 2. user enters 'b'
  // 3. ng-change kicks in and reverts scope value to 'a'
  //    -> scope value did not change since the last digest as
  //       ng-change executes in apply phase
  // 4. view should be changed back to 'a'
  ctrl.$$scope.$watch(function ngModelWatch(scope) {
    var modelValue = ctrl.$$ngModelGet(scope);

    // if scope model value and ngModel value are out of sync
    // This cannot be moved to the action function, because it would not catch the
    // case where the model is changed in the ngChange function or the model setter
    if (modelValue !== ctrl.$modelValue &&
      // checks for NaN is needed to allow setting the model to NaN when there's an asyncValidator
      // eslint-disable-next-line no-self-compare
      (ctrl.$modelValue === ctrl.$modelValue || modelValue === modelValue)
    ) {
      ctrl.$$setModelValue(modelValue);
    }

    return modelValue;
  });
}

/**
 * @ngdoc method
 * @name ngModel.NgModelController#$setValidity
 *
 * @description
 * Change the validity state, and notify the form.
 *
 * This method can be called within $parsers/$formatters or a custom validation implementation.
 * However, in most cases it should be sufficient to use the `ngModel.$validators` and
 * `ngModel.$asyncValidators` collections which will call `$setValidity` automatically.
 *
 * @param {string} validationErrorKey Name of the validator. The `validationErrorKey` will be assigned
 *        to either `$error[validationErrorKey]` or `$pending[validationErrorKey]`
 *        (for unfulfilled `$asyncValidators`), so that it is available for data-binding.
 *        The `validationErrorKey` should be in camelCase and will get converted into dash-case
 *        for class name. Example: `myError` will result in `ng-valid-my-error` and `ng-invalid-my-error`
 *        classes and can be bound to as `{{ someForm.someControl.$error.myError }}`.
 * @param {boolean} isValid Whether the current state is valid (true), invalid (false), pending (undefined),
 *                          or skipped (null). Pending is used for unfulfilled `$asyncValidators`.
 *                          Skipped is used by AngularJS when validators do not run because of parse errors and
 *                          when `$asyncValidators` do not run because any of the `$validators` failed.
 */
addSetValidityMethod({
  clazz: NgModelController,
  set: function(object, property) {
    object[property] = true;
  },
  unset: function(object, property) {
    delete object[property];
  }
});


/**
 * @ngdoc directive
 * @name ngModel
 * @restrict A
 * @priority 1
 * @param {expression} ngModel assignable {@link guide/expression Expression} to bind to.
 *
 * @description
 * The `ngModel` directive binds an `input`,`select`, `textarea` (or custom form control) to a
 * property on the scope using {@link ngModel.NgModelController NgModelController},
 * which is created and exposed by this directive.
 *
 * `ngModel` is responsible for:
 *
 * - Binding the view into the model, which other directives such as `input`, `textarea` or `select`
 *   require.
 * - Providing validation behavior (i.e. required, number, email, url).
 * - Keeping the state of the control (valid/invalid, dirty/pristine, touched/untouched, validation errors).
 * - Setting related css classes on the element (`ng-valid`, `ng-invalid`, `ng-dirty`, `ng-pristine`, `ng-touched`,
 *   `ng-untouched`, `ng-empty`, `ng-not-empty`) including animations.
 * - Registering the control with its parent {@link ng.directive:form form}.
 *
 * Note: `ngModel` will try to bind to the property given by evaluating the expression on the
 * current scope. If the property doesn't already exist on this scope, it will be created
 * implicitly and added to the scope.
 *
 * For best practices on using `ngModel`, see:
 *
 *  - [Understanding Scopes](https://github.com/angular/angular.js/wiki/Understanding-Scopes)
 *
 * For basic examples, how to use `ngModel`, see:
 *
 *  - {@link ng.directive:input input}
 *    - {@link input[text] text}
 *    - {@link input[checkbox] checkbox}
 *    - {@link input[radio] radio}
 *    - {@link input[number] number}
 *    - {@link input[email] email}
 *    - {@link input[url] url}
 *    - {@link input[date] date}
 *    - {@link input[datetime-local] datetime-local}
 *    - {@link input[time] time}
 *    - {@link input[month] month}
 *    - {@link input[week] week}
 *  - {@link ng.directive:select select}
 *  - {@link ng.directive:textarea textarea}
 *
 * ## Complex Models (objects or collections)
 *
 * By default, `ngModel` watches the model by reference, not value. This is important to know when
 * binding inputs to models that are objects (e.g. `Date`) or collections (e.g. arrays). If only properties of the
 * object or collection change, `ngModel` will not be notified and so the input will not be  re-rendered.
 *
 * The model must be assigned an entirely new object or collection before a re-rendering will occur.
 *
 * Some directives have options that will cause them to use a custom `$watchCollection` on the model expression
 * - for example, `ngOptions` will do so when a `track by` clause is included in the comprehension expression or
 * if the select is given the `multiple` attribute.
 *
 * The `$watchCollection()` method only does a shallow comparison, meaning that changing properties deeper than the
 * first level of the object (or only changing the properties of an item in the collection if it's an array) will still
 * not trigger a re-rendering of the model.
 *
 * ## CSS classes
 * The following CSS classes are added and removed on the associated input/select/textarea element
 * depending on the validity of the model.
 *
 *  - `ng-valid`: the model is valid
 *  - `ng-invalid`: the model is invalid
 *  - `ng-valid-[key]`: for each valid key added by `$setValidity`
 *  - `ng-invalid-[key]`: for each invalid key added by `$setValidity`
 *  - `ng-pristine`: the control hasn't been interacted with yet
 *  - `ng-dirty`: the control has been interacted with
 *  - `ng-touched`: the control has been blurred
 *  - `ng-untouched`: the control hasn't been blurred
 *  - `ng-pending`: any `$asyncValidators` are unfulfilled
 *  - `ng-empty`: the view does not contain a value or the value is deemed "empty", as defined
 *     by the {@link ngModel.NgModelController#$isEmpty} method
 *  - `ng-not-empty`: the view contains a non-empty value
 *
 * Keep in mind that ngAnimate can detect each of these classes when added and removed.
 *
 * @animations
 * Animations within models are triggered when any of the associated CSS classes are added and removed
 * on the input element which is attached to the model. These classes include: `.ng-pristine`, `.ng-dirty`,
 * `.ng-invalid` and `.ng-valid` as well as any other validations that are performed on the model itself.
 * The animations that are triggered within ngModel are similar to how they work in ngClass and
 * animations can be hooked into using CSS transitions, keyframes as well as JS animations.
 *
 * The following example shows a simple way to utilize CSS transitions to style an input element
 * that has been rendered as invalid after it has been validated:
 *
 * <pre>
 * //be sure to include ngAnimate as a module to hook into more
 * //advanced animations
 * .my-input {
 *   transition:0.5s linear all;
 *   background: white;
 * }
 * .my-input.ng-invalid {
 *   background: red;
 *   color:white;
 * }
 * </pre>
 *
 * @example
 * ### Basic Usage
 * <example deps="angular-animate.js" animations="true" fixBase="true" module="inputExample" name="ng-model">
     <file name="index.html">
       <script>
        angular.module('inputExample', [])
          .controller('ExampleController', ['$scope', function($scope) {
            $scope.val = '1';
          }]);
       </script>
       <style>
         .my-input {
           transition:all linear 0.5s;
           background: transparent;
         }
         .my-input.ng-invalid {
           color:white;
           background: red;
         }
       </style>
       <p id="inputDescription">
        Update input to see transitions when valid/invalid.
        Integer is a valid value.
       </p>
       <form name="testForm" ng-controller="ExampleController">
         <input ng-model="val" ng-pattern="/^\d+$/" name="anim" class="my-input"
                aria-describedby="inputDescription" />
       </form>
     </file>
 * </example>
 *
 * @example
 * ### Binding to a getter/setter
 *
 * Sometimes it's helpful to bind `ngModel` to a getter/setter function.  A getter/setter is a
 * function that returns a representation of the model when called with zero arguments, and sets
 * the internal state of a model when called with an argument. It's sometimes useful to use this
 * for models that have an internal representation that's different from what the model exposes
 * to the view.
 *
 * <div class="alert alert-success">
 * **Best Practice:** It's best to keep getters fast because AngularJS is likely to call them more
 * frequently than other parts of your code.
 * </div>
 *
 * You use this behavior by adding `ng-model-options="{ getterSetter: true }"` to an element that
 * has `ng-model` attached to it. You can also add `ng-model-options="{ getterSetter: true }"` to
 * a `<form>`, which will enable this behavior for all `<input>`s within it. See
 * {@link ng.directive:ngModelOptions `ngModelOptions`} for more.
 *
 * The following example shows how to use `ngModel` with a getter/setter:
 *
 * @example
 * <example name="ngModel-getter-setter" module="getterSetterExample">
     <file name="index.html">
       <div ng-controller="ExampleController">
         <form name="userForm">
           <label>Name:
             <input type="text" name="userName"
                    ng-model="user.name"
                    ng-model-options="{ getterSetter: true }" />
           </label>
         </form>
         <pre>user.name = <span ng-bind="user.name()"></span></pre>
       </div>
     </file>
     <file name="app.js">
       angular.module('getterSetterExample', [])
         .controller('ExampleController', ['$scope', function($scope) {
           var _name = 'Brian';
           $scope.user = {
             name: function(newName) {
              // Note that newName can be undefined for two reasons:
              // 1. Because it is called as a getter and thus called with no arguments
              // 2. Because the property should actually be set to undefined. This happens e.g. if the
              //    input is invalid
              return arguments.length ? (_name = newName) : _name;
             }
           };
         }]);
     </file>
 * </example>
 */
var ngModelDirective = ['$rootScope', function($rootScope) {
  return {
    restrict: 'A',
    require: ['ngModel', '^?form', '^?ngModelOptions'],
    controller: NgModelController,
    // Prelink needs to run before any input directive
    // so that we can set the NgModelOptions in NgModelController
    // before anyone else uses it.
    priority: 1,
    compile: function ngModelCompile(element) {
      // Setup initial state of the control
      element.addClass(PRISTINE_CLASS).addClass(UNTOUCHED_CLASS).addClass(VALID_CLASS);

      return {
        pre: function ngModelPreLink(scope, element, attr, ctrls) {
          var modelCtrl = ctrls[0],
              formCtrl = ctrls[1] || modelCtrl.$$parentForm,
              optionsCtrl = ctrls[2];

          if (optionsCtrl) {
            modelCtrl.$options = optionsCtrl.$options;
          }

          modelCtrl.$$initGetterSetters();

          // notify others, especially parent forms
          formCtrl.$addControl(modelCtrl);

          attr.$observe('name', function(newValue) {
            if (modelCtrl.$name !== newValue) {
              modelCtrl.$$parentForm.$$renameControl(modelCtrl, newValue);
            }
          });

          scope.$on('$destroy', function() {
            modelCtrl.$$parentForm.$removeControl(modelCtrl);
          });
        },
        post: function ngModelPostLink(scope, element, attr, ctrls) {
          var modelCtrl = ctrls[0];
          modelCtrl.$$setUpdateOnEvents();

          function setTouched() {
            modelCtrl.$setTouched();
          }

          element.on('blur', function() {
            if (modelCtrl.$touched) return;

            if ($rootScope.$$phase) {
              scope.$evalAsync(setTouched);
            } else {
              scope.$apply(setTouched);
            }
          });
        }
      };
    }
  };
}];

/* exported defaultModelOptions */
var defaultModelOptions;
var DEFAULT_REGEXP = /(\s+|^)default(\s+|$)/;

/**
 * @ngdoc type
 * @name ModelOptions
 * @description
 * A container for the options set by the {@link ngModelOptions} directive
 */
function ModelOptions(options) {
  this.$$options = options;
}

ModelOptions.prototype = {

  /**
   * @ngdoc method
   * @name ModelOptions#getOption
   * @param {string} name the name of the option to retrieve
   * @returns {*} the value of the option
   * @description
   * Returns the value of the given option
   */
  getOption: function(name) {
    return this.$$options[name];
  },

  /**
   * @ngdoc method
   * @name ModelOptions#createChild
   * @param {Object} options a hash of options for the new child that will override the parent's options
   * @return {ModelOptions} a new `ModelOptions` object initialized with the given options.
   */
  createChild: function(options) {
    var inheritAll = false;

    // make a shallow copy
    options = extend({}, options);

    // Inherit options from the parent if specified by the value `"$inherit"`
    forEach(options, /* @this */ function(option, key) {
      if (option === '$inherit') {
        if (key === '*') {
          inheritAll = true;
        } else {
          options[key] = this.$$options[key];
          // `updateOn` is special so we must also inherit the `updateOnDefault` option
          if (key === 'updateOn') {
            options.updateOnDefault = this.$$options.updateOnDefault;
          }
        }
      } else {
        if (key === 'updateOn') {
          // If the `updateOn` property contains the `default` event then we have to remove
          // it from the event list and set the `updateOnDefault` flag.
          options.updateOnDefault = false;
          options[key] = trim(option.replace(DEFAULT_REGEXP, function() {
            options.updateOnDefault = true;
            return ' ';
          }));
        }
      }
    }, this);

    if (inheritAll) {
      // We have a property of the form: `"*": "$inherit"`
      delete options['*'];
      defaults(options, this.$$options);
    }

    // Finally add in any missing defaults
    defaults(options, defaultModelOptions.$$options);

    return new ModelOptions(options);
  }
};


defaultModelOptions = new ModelOptions({
  updateOn: '',
  updateOnDefault: true,
  debounce: 0,
  getterSetter: false,
  allowInvalid: false,
  timezone: null
});


/**
 * @ngdoc directive
 * @name ngModelOptions
 * @restrict A
 * @priority 10
 *
 * @description
 * This directive allows you to modify the behaviour of {@link ngModel} directives within your
 * application. You can specify an `ngModelOptions` directive on any element. All {@link ngModel}
 * directives will use the options of their nearest `ngModelOptions` ancestor.
 *
 * The `ngModelOptions` settings are found by evaluating the value of the attribute directive as
 * an AngularJS expression. This expression should evaluate to an object, whose properties contain
 * the settings. For example: `<div ng-model-options="{ debounce: 100 }"`.
 *
 * ## Inheriting Options
 *
 * You can specify that an `ngModelOptions` setting should be inherited from a parent `ngModelOptions`
 * directive by giving it the value of `"$inherit"`.
 * Then it will inherit that setting from the first `ngModelOptions` directive found by traversing up the
 * DOM tree. If there is no ancestor element containing an `ngModelOptions` directive then default settings
 * will be used.
 *
 * For example given the following fragment of HTML
 *
 *
 * ```html
 * <div ng-model-options="{ allowInvalid: true, debounce: 200 }">
 *   <form ng-model-options="{ updateOn: 'blur', allowInvalid: '$inherit' }">
 *     <input ng-model-options="{ updateOn: 'default', allowInvalid: '$inherit' }" />
 *   </form>
 * </div>
 * ```
 *
 * the `input` element will have the following settings
 *
 * ```js
 * { allowInvalid: true, updateOn: 'default', debounce: 0 }
 * ```
 *
 * Notice that the `debounce` setting was not inherited and used the default value instead.
 *
 * You can specify that all undefined settings are automatically inherited from an ancestor by
 * including a property with key of `"*"` and value of `"$inherit"`.
 *
 * For example given the following fragment of HTML
 *
 *
 * ```html
 * <div ng-model-options="{ allowInvalid: true, debounce: 200 }">
 *   <form ng-model-options="{ updateOn: 'blur', "*": '$inherit' }">
 *     <input ng-model-options="{ updateOn: 'default', "*": '$inherit' }" />
 *   </form>
 * </div>
 * ```
 *
 * the `input` element will have the following settings
 *
 * ```js
 * { allowInvalid: true, updateOn: 'default', debounce: 200 }
 * ```
 *
 * Notice that the `debounce` setting now inherits the value from the outer `<div>` element.
 *
 * If you are creating a reusable component then you should be careful when using `"*": "$inherit"`
 * since you may inadvertently inherit a setting in the future that changes the behavior of your component.
 *
 *
 * ## Triggering and debouncing model updates
 *
 * The `updateOn` and `debounce` properties allow you to specify a custom list of events that will
 * trigger a model update and/or a debouncing delay so that the actual update only takes place when
 * a timer expires; this timer will be reset after another change takes place.
 *
 * Given the nature of `ngModelOptions`, the value displayed inside input fields in the view might
 * be different from the value in the actual model. This means that if you update the model you
 * should also invoke {@link ngModel.NgModelController#$rollbackViewValue} on the relevant input field in
 * order to make sure it is synchronized with the model and that any debounced action is canceled.
 *
 * The easiest way to reference the control's {@link ngModel.NgModelController#$rollbackViewValue}
 * method is by making sure the input is placed inside a form that has a `name` attribute. This is
 * important because `form` controllers are published to the related scope under the name in their
 * `name` attribute.
 *
 * Any pending changes will take place immediately when an enclosing form is submitted via the
 * `submit` event. Note that `ngClick` events will occur before the model is updated. Use `ngSubmit`
 * to have access to the updated model.
 *
 * ### Overriding immediate updates
 *
 * The following example shows how to override immediate updates. Changes on the inputs within the
 * form will update the model only when the control loses focus (blur event). If `escape` key is
 * pressed while the input field is focused, the value is reset to the value in the current model.
 *
 * <example name="ngModelOptions-directive-blur" module="optionsExample">
 *   <file name="index.html">
 *     <div ng-controller="ExampleController">
 *       <form name="userForm">
 *         <label>
 *           Name:
 *           <input type="text" name="userName"
 *                  ng-model="user.name"
 *                  ng-model-options="{ updateOn: 'blur' }"
 *                  ng-keyup="cancel($event)" />
 *         </label><br />
 *         <label>
 *           Other data:
 *           <input type="text" ng-model="user.data" />
 *         </label><br />
 *       </form>
 *       <pre>user.name = <span ng-bind="user.name"></span></pre>
 *     </div>
 *   </file>
 *   <file name="app.js">
 *     angular.module('optionsExample', [])
 *       .controller('ExampleController', ['$scope', function($scope) {
 *         $scope.user = { name: 'say', data: '' };
 *
 *         $scope.cancel = function(e) {
 *           if (e.keyCode === 27) {
 *             $scope.userForm.userName.$rollbackViewValue();
 *           }
 *         };
 *       }]);
 *   </file>
 *   <file name="protractor.js" type="protractor">
 *     var model = element(by.binding('user.name'));
 *     var input = element(by.model('user.name'));
 *     var other = element(by.model('user.data'));
 *
 *     it('should allow custom events', function() {
 *       input.sendKeys(' hello');
 *       input.click();
 *       expect(model.getText()).toEqual('say');
 *       other.click();
 *       expect(model.getText()).toEqual('say hello');
 *     });
 *
 *     it('should $rollbackViewValue when model changes', function() {
 *       input.sendKeys(' hello');
 *       expect(input.getAttribute('value')).toEqual('say hello');
 *       input.sendKeys(protractor.Key.ESCAPE);
 *       expect(input.getAttribute('value')).toEqual('say');
 *       other.click();
 *       expect(model.getText()).toEqual('say');
 *     });
 *   </file>
 * </example>
 *
 * ### Debouncing updates
 *
 * The next example shows how to debounce model changes. Model will be updated only 1 sec after last change.
 * If the `Clear` button is pressed, any debounced action is canceled and the value becomes empty.
 *
 * <example name="ngModelOptions-directive-debounce" module="optionsExample">
 *   <file name="index.html">
 *     <div ng-controller="ExampleController">
 *       <form name="userForm">
 *         Name:
 *         <input type="text" name="userName"
 *                ng-model="user.name"
 *                ng-model-options="{ debounce: 1000 }" />
 *         <button ng-click="userForm.userName.$rollbackViewValue(); user.name=''">Clear</button><br />
 *       </form>
 *       <pre>user.name = <span ng-bind="user.name"></span></pre>
 *     </div>
 *   </file>
 *   <file name="app.js">
 *     angular.module('optionsExample', [])
 *       .controller('ExampleController', ['$scope', function($scope) {
 *         $scope.user = { name: 'say' };
 *       }]);
 *   </file>
 * </example>
 *
 *
 * ## Model updates and validation
 *
 * The default behaviour in `ngModel` is that the model value is set to `undefined` when the
 * validation determines that the value is invalid. By setting the `allowInvalid` property to true,
 * the model will still be updated even if the value is invalid.
 *
 *
 * ## Connecting to the scope
 *
 * By setting the `getterSetter` property to true you are telling ngModel that the `ngModel` expression
 * on the scope refers to a "getter/setter" function rather than the value itself.
 *
 * The following example shows how to bind to getter/setters:
 *
 * <example name="ngModelOptions-directive-getter-setter" module="getterSetterExample">
 *   <file name="index.html">
 *     <div ng-controller="ExampleController">
 *       <form name="userForm">
 *         <label>
 *           Name:
 *           <input type="text" name="userName"
 *                  ng-model="user.name"
 *                  ng-model-options="{ getterSetter: true }" />
 *         </label>
 *       </form>
 *       <pre>user.name = <span ng-bind="user.name()"></span></pre>
 *     </div>
 *   </file>
 *   <file name="app.js">
 *     angular.module('getterSetterExample', [])
 *       .controller('ExampleController', ['$scope', function($scope) {
 *         var _name = 'Brian';
 *         $scope.user = {
 *           name: function(newName) {
 *             return angular.isDefined(newName) ? (_name = newName) : _name;
 *           }
 *         };
 *       }]);
 *   </file>
 * </example>
 *
 *
 * ## Specifying timezones
 *
 * You can specify the timezone that date/time input directives expect by providing its name in the
 * `timezone` property.
 *
 *
 * ## Programmatically changing options
 *
 * The `ngModelOptions` expression is only evaluated once when the directive is linked; it is not
 * watched for changes. However, it is possible to override the options on a single
 * {@link ngModel.NgModelController} instance with
 * {@link ngModel.NgModelController#$overrideModelOptions `NgModelController#$overrideModelOptions()`}.
 *
 *
 * @param {Object} ngModelOptions options to apply to {@link ngModel} directives on this element and
 *   and its descendents. Valid keys are:
 *   - `updateOn`: string specifying which event should the input be bound to. You can set several
 *     events using an space delimited list. There is a special event called `default` that
 *     matches the default events belonging to the control. These are the events that are bound to
 *     the control, and when fired, update the `$viewValue` via `$setViewValue`.
 *
 *     `ngModelOptions` considers every event that is not listed in `updateOn` a "default" event,
 *     since different control types use different default events.
 *
 *     See also the section {@link ngModelOptions#triggering-and-debouncing-model-updates
 *     Triggering and debouncing model updates}.
 *
 *   - `debounce`: integer value which contains the debounce model update value in milliseconds. A
 *     value of 0 triggers an immediate update. If an object is supplied instead, you can specify a
 *     custom value for each event. For example:
 *     ```
 *     ng-model-options="{
 *       updateOn: 'default blur click',
 *       debounce: { 'default': 500, 'blur': 0 }
 *     }"
 *     ```
 *
 *     "default" also applies to all events that are listed in `updateOn` but are not
 *     listed in `debounce`, i.e. "click" would also be debounced by 500 milliseconds.
 *
 *   - `allowInvalid`: boolean value which indicates that the model can be set with values that did
 *     not validate correctly instead of the default behavior of setting the model to undefined.
 *   - `getterSetter`: boolean value which determines whether or not to treat functions bound to
 *     `ngModel` as getters/setters.
 *   - `timezone`: Defines the timezone to be used to read/write the `Date` instance in the model for
 *     `<input type="date" />`, `<input type="time" />`, ... . It understands UTC/GMT and the
 *     continental US time zone abbreviations, but for general use, use a time zone offset, for
 *     example, `'+0430'` (4 hours, 30 minutes east of the Greenwich meridian)
 *     If not specified, the timezone of the browser will be used.
 *
 */