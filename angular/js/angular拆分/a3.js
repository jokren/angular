if (childLinkFn) {
    childLinkFn(scopeToChild, linkNode.childNodes, undefined, boundTranscludeFn);
  }

  // POSTLINKING
  for (i = postLinkFns.length - 1; i >= 0; i--) {
    linkFn = postLinkFns[i];
    invokeLinkFn(linkFn,
        linkFn.isolateScope ? isolateScope : scope,
        $element,
        attrs,
        linkFn.require && getControllers(linkFn.directiveName, linkFn.require, $element, elementControllers),
        transcludeFn
    );
  }

  // Trigger $postLink lifecycle hooks
  forEach(elementControllers, function(controller) {
    var controllerInstance = controller.instance;
    if (isFunction(controllerInstance.$postLink)) {
      controllerInstance.$postLink();
    }
  });

  // This is the function that is injected as `$transclude`.
  // Note: all arguments are optional!
  function controllersBoundTransclude(scope, cloneAttachFn, futureParentElement, slotName) {
    var transcludeControllers;
    // No scope passed in:
    if (!isScope(scope)) {
      slotName = futureParentElement;
      futureParentElement = cloneAttachFn;
      cloneAttachFn = scope;
      scope = undefined;
    }

    if (hasElementTranscludeDirective) {
      transcludeControllers = elementControllers;
    }
    if (!futureParentElement) {
      futureParentElement = hasElementTranscludeDirective ? $element.parent() : $element;
    }
    if (slotName) {
      // slotTranscludeFn can be one of three things:
      //  * a transclude function - a filled slot
      //  * `null` - an optional slot that was not filled
      //  * `undefined` - a slot that was not declared (i.e. invalid)
      var slotTranscludeFn = boundTranscludeFn.$$slots[slotName];
      if (slotTranscludeFn) {
        return slotTranscludeFn(scope, cloneAttachFn, transcludeControllers, futureParentElement, scopeToChild);
      } else if (isUndefined(slotTranscludeFn)) {
        throw $compileMinErr('noslot',
         'No parent directive that requires a transclusion with slot name "{0}". ' +
         'Element: {1}',
         slotName, startingTag($element));
      }
    } else {
      return boundTranscludeFn(scope, cloneAttachFn, transcludeControllers, futureParentElement, scopeToChild);
    }
  }
}
}

function getControllers(directiveName, require, $element, elementControllers) {
var value;

if (isString(require)) {
  var match = require.match(REQUIRE_PREFIX_REGEXP);
  var name = require.substring(match[0].length);
  var inheritType = match[1] || match[3];
  var optional = match[2] === '?';

  //If only parents then start at the parent element
  if (inheritType === '^^') {
    $element = $element.parent();
  //Otherwise attempt getting the controller from elementControllers in case
  //the element is transcluded (and has no data) and to avoid .data if possible
  } else {
    value = elementControllers && elementControllers[name];
    value = value && value.instance;
  }

  if (!value) {
    var dataName = '$' + name + 'Controller';
    value = inheritType ? $element.inheritedData(dataName) : $element.data(dataName);
  }

  if (!value && !optional) {
    throw $compileMinErr('ctreq',
        'Controller \'{0}\', required by directive \'{1}\', can\'t be found!',
        name, directiveName);
  }
} else if (isArray(require)) {
  value = [];
  for (var i = 0, ii = require.length; i < ii; i++) {
    value[i] = getControllers(directiveName, require[i], $element, elementControllers);
  }
} else if (isObject(require)) {
  value = {};
  forEach(require, function(controller, property) {
    value[property] = getControllers(directiveName, controller, $element, elementControllers);
  });
}

return value || null;
}

function setupControllers($element, attrs, transcludeFn, controllerDirectives, isolateScope, scope, newIsolateScopeDirective) {
var elementControllers = createMap();
for (var controllerKey in controllerDirectives) {
  var directive = controllerDirectives[controllerKey];
  var locals = {
    $scope: directive === newIsolateScopeDirective || directive.$$isolateScope ? isolateScope : scope,
    $element: $element,
    $attrs: attrs,
    $transclude: transcludeFn
  };

  var controller = directive.controller;
  if (controller === '@') {
    controller = attrs[directive.name];
  }

  var controllerInstance = $controller(controller, locals, true, directive.controllerAs);

  // For directives with element transclusion the element is a comment.
  // In this case .data will not attach any data.
  // Instead, we save the controllers for the element in a local hash and attach to .data
  // later, once we have the actual element.
  elementControllers[directive.name] = controllerInstance;
  $element.data('$' + directive.name + 'Controller', controllerInstance.instance);
}
return elementControllers;
}

// Depending upon the context in which a directive finds itself it might need to have a new isolated
// or child scope created. For instance:
// * if the directive has been pulled into a template because another directive with a higher priority
// asked for element transclusion
// * if the directive itself asks for transclusion but it is at the root of a template and the original
// element was replaced. See https://github.com/angular/angular.js/issues/12936
function markDirectiveScope(directives, isolateScope, newScope) {
for (var j = 0, jj = directives.length; j < jj; j++) {
  directives[j] = inherit(directives[j], {$$isolateScope: isolateScope, $$newScope: newScope});
}
}

/**
* looks up the directive and decorates it with exception handling and proper parameters. We
* call this the boundDirective.
*
* @param {string} name name of the directive to look up.
* @param {string} location The directive must be found in specific format.
*   String containing any of theses characters:
*
*   * `E`: element name
*   * `A': attribute
*   * `C`: class
*   * `M`: comment
* @returns {boolean} true if directive was added.
*/
function addDirective(tDirectives, name, location, maxPriority, ignoreDirective, startAttrName,
                    endAttrName) {
if (name === ignoreDirective) return null;
var match = null;
if (hasDirectives.hasOwnProperty(name)) {
  for (var directive, directives = $injector.get(name + Suffix),
      i = 0, ii = directives.length; i < ii; i++) {
    directive = directives[i];
    if ((isUndefined(maxPriority) || maxPriority > directive.priority) &&
         directive.restrict.indexOf(location) !== -1) {
      if (startAttrName) {
        directive = inherit(directive, {$$start: startAttrName, $$end: endAttrName});
      }
      if (!directive.$$bindings) {
        var bindings = directive.$$bindings =
            parseDirectiveBindings(directive, directive.name);
        if (isObject(bindings.isolateScope)) {
          directive.$$isolateBindings = bindings.isolateScope;
        }
      }
      tDirectives.push(directive);
      match = directive;
    }
  }
}
return match;
}


/**
* looks up the directive and returns true if it is a multi-element directive,
* and therefore requires DOM nodes between -start and -end markers to be grouped
* together.
*
* @param {string} name name of the directive to look up.
* @returns true if directive was registered as multi-element.
*/
function directiveIsMultiElement(name) {
if (hasDirectives.hasOwnProperty(name)) {
  for (var directive, directives = $injector.get(name + Suffix),
      i = 0, ii = directives.length; i < ii; i++) {
    directive = directives[i];
    if (directive.multiElement) {
      return true;
    }
  }
}
return false;
}

/**
* When the element is replaced with HTML template then the new attributes
* on the template need to be merged with the existing attributes in the DOM.
* The desired effect is to have both of the attributes present.
*
* @param {object} dst destination attributes (original DOM)
* @param {object} src source attributes (from the directive template)
*/
function mergeTemplateAttributes(dst, src) {
var srcAttr = src.$attr,
    dstAttr = dst.$attr;

// reapply the old attributes to the new element
forEach(dst, function(value, key) {
  if (key.charAt(0) !== '$') {
    if (src[key] && src[key] !== value) {
      if (value.length) {
        value += (key === 'style' ? ';' : ' ') + src[key];
      } else {
        value = src[key];
      }
    }
    dst.$set(key, value, true, srcAttr[key]);
  }
});

// copy the new attributes on the old attrs object
forEach(src, function(value, key) {
  // Check if we already set this attribute in the loop above.
  // `dst` will never contain hasOwnProperty as DOM parser won't let it.
  // You will get an "InvalidCharacterError: DOM Exception 5" error if you
  // have an attribute like "has-own-property" or "data-has-own-property", etc.
  if (!dst.hasOwnProperty(key) && key.charAt(0) !== '$') {
    dst[key] = value;

    if (key !== 'class' && key !== 'style') {
      dstAttr[key] = srcAttr[key];
    }
  }
});
}


function compileTemplateUrl(directives, $compileNode, tAttrs,
  $rootElement, childTranscludeFn, preLinkFns, postLinkFns, previousCompileContext) {
var linkQueue = [],
    afterTemplateNodeLinkFn,
    afterTemplateChildLinkFn,
    beforeTemplateCompileNode = $compileNode[0],
    origAsyncDirective = directives.shift(),
    derivedSyncDirective = inherit(origAsyncDirective, {
      templateUrl: null, transclude: null, replace: null, $$originalDirective: origAsyncDirective
    }),
    templateUrl = (isFunction(origAsyncDirective.templateUrl))
        ? origAsyncDirective.templateUrl($compileNode, tAttrs)
        : origAsyncDirective.templateUrl,
    templateNamespace = origAsyncDirective.templateNamespace;

$compileNode.empty();

$templateRequest(templateUrl)
  .then(function(content) {
    var compileNode, tempTemplateAttrs, $template, childBoundTranscludeFn;

    content = denormalizeTemplate(content);

    if (origAsyncDirective.replace) {
      if (jqLiteIsTextNode(content)) {
        $template = [];
      } else {
        $template = removeComments(wrapTemplate(templateNamespace, trim(content)));
      }
      compileNode = $template[0];

      if ($template.length !== 1 || compileNode.nodeType !== NODE_TYPE_ELEMENT) {
        throw $compileMinErr('tplrt',
            'Template for directive \'{0}\' must have exactly one root element. {1}',
            origAsyncDirective.name, templateUrl);
      }

      tempTemplateAttrs = {$attr: {}};
      replaceWith($rootElement, $compileNode, compileNode);
      var templateDirectives = collectDirectives(compileNode, [], tempTemplateAttrs);

      if (isObject(origAsyncDirective.scope)) {
        // the original directive that caused the template to be loaded async required
        // an isolate scope
        markDirectiveScope(templateDirectives, true);
      }
      directives = templateDirectives.concat(directives);
      mergeTemplateAttributes(tAttrs, tempTemplateAttrs);
    } else {
      compileNode = beforeTemplateCompileNode;
      $compileNode.html(content);
    }

    directives.unshift(derivedSyncDirective);

    afterTemplateNodeLinkFn = applyDirectivesToNode(directives, compileNode, tAttrs,
        childTranscludeFn, $compileNode, origAsyncDirective, preLinkFns, postLinkFns,
        previousCompileContext);
    forEach($rootElement, function(node, i) {
      if (node === compileNode) {
        $rootElement[i] = $compileNode[0];
      }
    });
    afterTemplateChildLinkFn = compileNodes($compileNode[0].childNodes, childTranscludeFn);

    while (linkQueue.length) {
      var scope = linkQueue.shift(),
          beforeTemplateLinkNode = linkQueue.shift(),
          linkRootElement = linkQueue.shift(),
          boundTranscludeFn = linkQueue.shift(),
          linkNode = $compileNode[0];

      if (scope.$$destroyed) continue;

      if (beforeTemplateLinkNode !== beforeTemplateCompileNode) {
        var oldClasses = beforeTemplateLinkNode.className;

        if (!(previousCompileContext.hasElementTranscludeDirective &&
            origAsyncDirective.replace)) {
          // it was cloned therefore we have to clone as well.
          linkNode = jqLiteClone(compileNode);
        }
        replaceWith(linkRootElement, jqLite(beforeTemplateLinkNode), linkNode);

        // Copy in CSS classes from original node
        safeAddClass(jqLite(linkNode), oldClasses);
      }
      if (afterTemplateNodeLinkFn.transcludeOnThisElement) {
        childBoundTranscludeFn = createBoundTranscludeFn(scope, afterTemplateNodeLinkFn.transclude, boundTranscludeFn);
      } else {
        childBoundTranscludeFn = boundTranscludeFn;
      }
      afterTemplateNodeLinkFn(afterTemplateChildLinkFn, scope, linkNode, $rootElement,
        childBoundTranscludeFn);
    }
    linkQueue = null;
  }).catch(function(error) {
    if (isError(error)) {
      $exceptionHandler(error);
    }
  });

return function delayedNodeLinkFn(ignoreChildLinkFn, scope, node, rootElement, boundTranscludeFn) {
  var childBoundTranscludeFn = boundTranscludeFn;
  if (scope.$$destroyed) return;
  if (linkQueue) {
    linkQueue.push(scope,
                   node,
                   rootElement,
                   childBoundTranscludeFn);
  } else {
    if (afterTemplateNodeLinkFn.transcludeOnThisElement) {
      childBoundTranscludeFn = createBoundTranscludeFn(scope, afterTemplateNodeLinkFn.transclude, boundTranscludeFn);
    }
    afterTemplateNodeLinkFn(afterTemplateChildLinkFn, scope, node, rootElement, childBoundTranscludeFn);
  }
};
}


/**
* Sorting function for bound directives.
*/
function byPriority(a, b) {
var diff = b.priority - a.priority;
if (diff !== 0) return diff;
if (a.name !== b.name) return (a.name < b.name) ? -1 : 1;
return a.index - b.index;
}

function assertNoDuplicate(what, previousDirective, directive, element) {

function wrapModuleNameIfDefined(moduleName) {
  return moduleName ?
    (' (module: ' + moduleName + ')') :
    '';
}

if (previousDirective) {
  throw $compileMinErr('multidir', 'Multiple directives [{0}{1}, {2}{3}] asking for {4} on: {5}',
      previousDirective.name, wrapModuleNameIfDefined(previousDirective.$$moduleName),
      directive.name, wrapModuleNameIfDefined(directive.$$moduleName), what, startingTag(element));
}
}


function addTextInterpolateDirective(directives, text) {
var interpolateFn = $interpolate(text, true);
if (interpolateFn) {
  directives.push({
    priority: 0,
    compile: function textInterpolateCompileFn(templateNode) {
      var templateNodeParent = templateNode.parent(),
          hasCompileParent = !!templateNodeParent.length;

      // When transcluding a template that has bindings in the root
      // we don't have a parent and thus need to add the class during linking fn.
      if (hasCompileParent) compile.$$addBindingClass(templateNodeParent);

      return function textInterpolateLinkFn(scope, node) {
        var parent = node.parent();
        if (!hasCompileParent) compile.$$addBindingClass(parent);
        compile.$$addBindingInfo(parent, interpolateFn.expressions);
        scope.$watch(interpolateFn, function interpolateFnWatchAction(value) {
          node[0].nodeValue = value;
        });
      };
    }
  });
}
}


function wrapTemplate(type, template) {
type = lowercase(type || 'html');
switch (type) {
case 'svg':
case 'math':
  var wrapper = window.document.createElement('div');
  wrapper.innerHTML = '<' + type + '>' + template + '</' + type + '>';
  return wrapper.childNodes[0].childNodes;
default:
  return template;
}
}


function getTrustedContext(node, attrNormalizedName) {
if (attrNormalizedName === 'srcdoc') {
  return $sce.HTML;
}
var tag = nodeName_(node);
// All tags with src attributes require a RESOURCE_URL value, except for
// img and various html5 media tags.
if (attrNormalizedName === 'src' || attrNormalizedName === 'ngSrc') {
  if (['img', 'video', 'audio', 'source', 'track'].indexOf(tag) === -1) {
    return $sce.RESOURCE_URL;
  }
// maction[xlink:href] can source SVG.  It's not limited to <maction>.
} else if (attrNormalizedName === 'xlinkHref' ||
    (tag === 'form' && attrNormalizedName === 'action') ||
    // links can be stylesheets or imports, which can run script in the current origin
    (tag === 'link' && attrNormalizedName === 'href')
) {
  return $sce.RESOURCE_URL;
}
}


function addAttrInterpolateDirective(node, directives, value, name, isNgAttr) {
var trustedContext = getTrustedContext(node, name);
var mustHaveExpression = !isNgAttr;
var allOrNothing = ALL_OR_NOTHING_ATTRS[name] || isNgAttr;

var interpolateFn = $interpolate(value, mustHaveExpression, trustedContext, allOrNothing);

// no interpolation found -> ignore
if (!interpolateFn) return;

if (name === 'multiple' && nodeName_(node) === 'select') {
  throw $compileMinErr('selmulti',
      'Binding to the \'multiple\' attribute is not supported. Element: {0}',
      startingTag(node));
}

if (EVENT_HANDLER_ATTR_REGEXP.test(name)) {
  throw $compileMinErr('nodomevents',
      'Interpolations for HTML DOM event attributes are disallowed.  Please use the ' +
          'ng- versions (such as ng-click instead of onclick) instead.');
}

directives.push({
  priority: 100,
  compile: function() {
      return {
        pre: function attrInterpolatePreLinkFn(scope, element, attr) {
          var $$observers = (attr.$$observers || (attr.$$observers = createMap()));

          // If the attribute has changed since last $interpolate()ed
          var newValue = attr[name];
          if (newValue !== value) {
            // we need to interpolate again since the attribute value has been updated
            // (e.g. by another directive's compile function)
            // ensure unset/empty values make interpolateFn falsy
            interpolateFn = newValue && $interpolate(newValue, true, trustedContext, allOrNothing);
            value = newValue;
          }

          // if attribute was updated so that there is no interpolation going on we don't want to
          // register any observers
          if (!interpolateFn) return;

          // initialize attr object so that it's ready in case we need the value for isolate
          // scope initialization, otherwise the value would not be available from isolate
          // directive's linking fn during linking phase
          attr[name] = interpolateFn(scope);

          ($$observers[name] || ($$observers[name] = [])).$$inter = true;
          (attr.$$observers && attr.$$observers[name].$$scope || scope).
            $watch(interpolateFn, function interpolateFnWatchAction(newValue, oldValue) {
              //special case for class attribute addition + removal
              //so that class changes can tap into the animation
              //hooks provided by the $animate service. Be sure to
              //skip animations when the first digest occurs (when
              //both the new and the old values are the same) since
              //the CSS classes are the non-interpolated values
              if (name === 'class' && newValue !== oldValue) {
                attr.$updateClass(newValue, oldValue);
              } else {
                attr.$set(name, newValue);
              }
            });
        }
      };
    }
});
}


/**
* This is a special jqLite.replaceWith, which can replace items which
* have no parents, provided that the containing jqLite collection is provided.
*
* @param {JqLite=} $rootElement The root of the compile tree. Used so that we can replace nodes
*                               in the root of the tree.
* @param {JqLite} elementsToRemove The jqLite element which we are going to replace. We keep
*                                  the shell, but replace its DOM node reference.
* @param {Node} newNode The new DOM node.
*/
function replaceWith($rootElement, elementsToRemove, newNode) {
var firstElementToRemove = elementsToRemove[0],
    removeCount = elementsToRemove.length,
    parent = firstElementToRemove.parentNode,
    i, ii;

if ($rootElement) {
  for (i = 0, ii = $rootElement.length; i < ii; i++) {
    if ($rootElement[i] === firstElementToRemove) {
      $rootElement[i++] = newNode;
      for (var j = i, j2 = j + removeCount - 1,
               jj = $rootElement.length;
           j < jj; j++, j2++) {
        if (j2 < jj) {
          $rootElement[j] = $rootElement[j2];
        } else {
          delete $rootElement[j];
        }
      }
      $rootElement.length -= removeCount - 1;

      // If the replaced element is also the jQuery .context then replace it
      // .context is a deprecated jQuery api, so we should set it only when jQuery set it
      // http://api.jquery.com/context/
      if ($rootElement.context === firstElementToRemove) {
        $rootElement.context = newNode;
      }
      break;
    }
  }
}

if (parent) {
  parent.replaceChild(newNode, firstElementToRemove);
}

// Append all the `elementsToRemove` to a fragment. This will...
// - remove them from the DOM
// - allow them to still be traversed with .nextSibling
// - allow a single fragment.qSA to fetch all elements being removed
var fragment = window.document.createDocumentFragment();
for (i = 0; i < removeCount; i++) {
  fragment.appendChild(elementsToRemove[i]);
}

if (jqLite.hasData(firstElementToRemove)) {
  // Copy over user data (that includes AngularJS's $scope etc.). Don't copy private
  // data here because there's no public interface in jQuery to do that and copying over
  // event listeners (which is the main use of private data) wouldn't work anyway.
  jqLite.data(newNode, jqLite.data(firstElementToRemove));

  // Remove $destroy event listeners from `firstElementToRemove`
  jqLite(firstElementToRemove).off('$destroy');
}

// Cleanup any data/listeners on the elements and children.
// This includes invoking the $destroy event on any elements with listeners.
jqLite.cleanData(fragment.querySelectorAll('*'));

// Update the jqLite collection to only contain the `newNode`
for (i = 1; i < removeCount; i++) {
  delete elementsToRemove[i];
}
elementsToRemove[0] = newNode;
elementsToRemove.length = 1;
}


function cloneAndAnnotateFn(fn, annotation) {
return extend(function() { return fn.apply(null, arguments); }, fn, annotation);
}


function invokeLinkFn(linkFn, scope, $element, attrs, controllers, transcludeFn) {
try {
  linkFn(scope, $element, attrs, controllers, transcludeFn);
} catch (e) {
  $exceptionHandler(e, startingTag($element));
}
}

function strictBindingsCheck(attrName, directiveName) {
if (strictComponentBindingsEnabled) {
  throw $compileMinErr('missingattr',
    'Attribute \'{0}\' of \'{1}\' is non-optional and must be set!',
    attrName, directiveName);
}
}

// Set up $watches for isolate scope and controller bindings.
function initializeDirectiveBindings(scope, attrs, destination, bindings, directive) {
var removeWatchCollection = [];
var initialChanges = {};
var changes;

forEach(bindings, function initializeBinding(definition, scopeName) {
  var attrName = definition.attrName,
  optional = definition.optional,
  mode = definition.mode, // @, =, <, or &
  lastValue,
  parentGet, parentSet, compare, removeWatch;

  switch (mode) {

    case '@':
      if (!optional && !hasOwnProperty.call(attrs, attrName)) {
        strictBindingsCheck(attrName, directive.name);
        destination[scopeName] = attrs[attrName] = undefined;

      }
      removeWatch = attrs.$observe(attrName, function(value) {
        if (isString(value) || isBoolean(value)) {
          var oldValue = destination[scopeName];
          recordChanges(scopeName, value, oldValue);
          destination[scopeName] = value;
        }
      });
      attrs.$$observers[attrName].$$scope = scope;
      lastValue = attrs[attrName];
      if (isString(lastValue)) {
        // If the attribute has been provided then we trigger an interpolation to ensure
        // the value is there for use in the link fn
        destination[scopeName] = $interpolate(lastValue)(scope);
      } else if (isBoolean(lastValue)) {
        // If the attributes is one of the BOOLEAN_ATTR then AngularJS will have converted
        // the value to boolean rather than a string, so we special case this situation
        destination[scopeName] = lastValue;
      }
      initialChanges[scopeName] = new SimpleChange(_UNINITIALIZED_VALUE, destination[scopeName]);
      removeWatchCollection.push(removeWatch);
      break;

    case '=':
      if (!hasOwnProperty.call(attrs, attrName)) {
        if (optional) break;
        strictBindingsCheck(attrName, directive.name);
        attrs[attrName] = undefined;
      }
      if (optional && !attrs[attrName]) break;

      parentGet = $parse(attrs[attrName]);
      if (parentGet.literal) {
        compare = equals;
      } else {
        compare = simpleCompare;
      }
      parentSet = parentGet.assign || function() {
        // reset the change, or we will throw this exception on every $digest
        lastValue = destination[scopeName] = parentGet(scope);
        throw $compileMinErr('nonassign',
            'Expression \'{0}\' in attribute \'{1}\' used with directive \'{2}\' is non-assignable!',
            attrs[attrName], attrName, directive.name);
      };
      lastValue = destination[scopeName] = parentGet(scope);
      var parentValueWatch = function parentValueWatch(parentValue) {
        if (!compare(parentValue, destination[scopeName])) {
          // we are out of sync and need to copy
          if (!compare(parentValue, lastValue)) {
            // parent changed and it has precedence
            destination[scopeName] = parentValue;
          } else {
            // if the parent can be assigned then do so
            parentSet(scope, parentValue = destination[scopeName]);
          }
        }
        lastValue = parentValue;
        return lastValue;
      };
      parentValueWatch.$stateful = true;
      if (definition.collection) {
        removeWatch = scope.$watchCollection(attrs[attrName], parentValueWatch);
      } else {
        removeWatch = scope.$watch($parse(attrs[attrName], parentValueWatch), null, parentGet.literal);
      }
      removeWatchCollection.push(removeWatch);
      break;

    case '<':
      if (!hasOwnProperty.call(attrs, attrName)) {
        if (optional) break;
        strictBindingsCheck(attrName, directive.name);
        attrs[attrName] = undefined;
      }
      if (optional && !attrs[attrName]) break;

      parentGet = $parse(attrs[attrName]);
      var deepWatch = parentGet.literal;

      var initialValue = destination[scopeName] = parentGet(scope);
      initialChanges[scopeName] = new SimpleChange(_UNINITIALIZED_VALUE, destination[scopeName]);

      removeWatch = scope.$watch(parentGet, function parentValueWatchAction(newValue, oldValue) {
        if (oldValue === newValue) {
          if (oldValue === initialValue || (deepWatch && equals(oldValue, initialValue))) {
            return;
          }
          oldValue = initialValue;
        }
        recordChanges(scopeName, newValue, oldValue);
        destination[scopeName] = newValue;
      }, deepWatch);

      removeWatchCollection.push(removeWatch);
      break;

    case '&':
      if (!optional && !hasOwnProperty.call(attrs, attrName)) {
        strictBindingsCheck(attrName, directive.name);
      }
      // Don't assign Object.prototype method to scope
      parentGet = attrs.hasOwnProperty(attrName) ? $parse(attrs[attrName]) : noop;

      // Don't assign noop to destination if expression is not valid
      if (parentGet === noop && optional) break;

      destination[scopeName] = function(locals) {
        return parentGet(scope, locals);
      };
      break;
  }
});

function recordChanges(key, currentValue, previousValue) {
  if (isFunction(destination.$onChanges) && !simpleCompare(currentValue, previousValue)) {
    // If we have not already scheduled the top level onChangesQueue handler then do so now
    if (!onChangesQueue) {
      scope.$$postDigest(flushOnChangesQueue);
      onChangesQueue = [];
    }
    // If we have not already queued a trigger of onChanges for this controller then do so now
    if (!changes) {
      changes = {};
      onChangesQueue.push(triggerOnChangesHook);
    }
    // If the has been a change on this property already then we need to reuse the previous value
    if (changes[key]) {
      previousValue = changes[key].previousValue;
    }
    // Store this change
    changes[key] = new SimpleChange(previousValue, currentValue);
  }
}

function triggerOnChangesHook() {
  destination.$onChanges(changes);
  // Now clear the changes so that we schedule onChanges when more changes arrive
  changes = undefined;
}

return {
  initialChanges: initialChanges,
  removeWatches: removeWatchCollection.length && function removeWatches() {
    for (var i = 0, ii = removeWatchCollection.length; i < ii; ++i) {
      removeWatchCollection[i]();
    }
  }
};
}
}];
}

function SimpleChange(previous, current) {
this.previousValue = previous;
this.currentValue = current;
}
SimpleChange.prototype.isFirstChange = function() { return this.previousValue === _UNINITIALIZED_VALUE; };


var PREFIX_REGEXP = /^((?:x|data)[:\-_])/i;
var SPECIAL_CHARS_REGEXP = /[:\-_]+(.)/g;

/**
* Converts all accepted directives format into proper directive name.
* @param name Name to normalize
*/
function directiveNormalize(name) {
return name
.replace(PREFIX_REGEXP, '')
.replace(SPECIAL_CHARS_REGEXP, function(_, letter, offset) {
return offset ? letter.toUpperCase() : letter;
});
}

/**
* @ngdoc type
* @name $compile.directive.Attributes
*
* @description
* A shared object between directive compile / linking functions which contains normalized DOM
* element attributes. The values reflect current binding state `{{ }}`. The normalization is
* needed since all of these are treated as equivalent in AngularJS:
*
* ```
*    <span ng:bind="a" ng-bind="a" data-ng-bind="a" x-ng-bind="a">
* ```
*/

/**
* @ngdoc property
* @name $compile.directive.Attributes#$attr
*
* @description
* A map of DOM element attribute names to the normalized name. This is
* needed to do reverse lookup from normalized name back to actual name.
*/


/**
* @ngdoc method
* @name $compile.directive.Attributes#$set
* @kind function
*
* @description
* Set DOM element attribute value.
*
*
* @param {string} name Normalized element attribute name of the property to modify. The name is
*          reverse-translated using the {@link ng.$compile.directive.Attributes#$attr $attr}
*          property to the original name.
* @param {string} value Value to set the attribute to. The value can be an interpolated string.
*/



/**
* Closure compiler type information
*/

function nodesetLinkingFn(
/* angular.Scope */ scope,
/* NodeList */ nodeList,
/* Element */ rootElement,
/* function(Function) */ boundTranscludeFn
) {}

function directiveLinkingFn(
/* nodesetLinkingFn */ nodesetLinkingFn,
/* angular.Scope */ scope,
/* Node */ node,
/* Element */ rootElement,
/* function(Function) */ boundTranscludeFn
) {}

function tokenDifference(str1, str2) {
var values = '',
tokens1 = str1.split(/\s+/),
tokens2 = str2.split(/\s+/);

outer:
for (var i = 0; i < tokens1.length; i++) {
var token = tokens1[i];
for (var j = 0; j < tokens2.length; j++) {
if (token === tokens2[j]) continue outer;
}
values += (values.length > 0 ? ' ' : '') + token;
}
return values;
}

function removeComments(jqNodes) {
jqNodes = jqLite(jqNodes);
var i = jqNodes.length;

if (i <= 1) {
return jqNodes;
}

while (i--) {
var node = jqNodes[i];
if (node.nodeType === NODE_TYPE_COMMENT ||
 (node.nodeType === NODE_TYPE_TEXT && node.nodeValue.trim() === '')) {
   splice.call(jqNodes, i, 1);
}
}
return jqNodes;
}

var $controllerMinErr = minErr('$controller');


var CNTRL_REG = /^(\S+)(\s+as\s+([\w$]+))?$/;
function identifierForController(controller, ident) {
if (ident && isString(ident)) return ident;
if (isString(controller)) {
var match = CNTRL_REG.exec(controller);
if (match) return match[3];
}
}


/**
* @ngdoc provider
* @name $controllerProvider
* @this
*
* @description
* The {@link ng.$controller $controller service} is used by AngularJS to create new
* controllers.
*
* This provider allows controller registration via the
* {@link ng.$controllerProvider#register register} method.
*/
function $ControllerProvider() {
var controllers = {},
globals = false;

/**
* @ngdoc method
* @name $controllerProvider#has
* @param {string} name Controller name to check.
*/
this.has = function(name) {
return controllers.hasOwnProperty(name);
};

/**
* @ngdoc method
* @name $controllerProvider#register
* @param {string|Object} name Controller name, or an object map of controllers where the keys are
*    the names and the values are the constructors.
* @param {Function|Array} constructor Controller constructor fn (optionally decorated with DI
*    annotations in the array notation).
*/
this.register = function(name, constructor) {
assertNotHasOwnProperty(name, 'controller');
if (isObject(name)) {
extend(controllers, name);
} else {
controllers[name] = constructor;
}
};

/**
* @ngdoc method
* @name $controllerProvider#allowGlobals
* @description If called, allows `$controller` to find controller constructors on `window`
*
* @deprecated
* sinceVersion="v1.3.0"
* removeVersion="v1.7.0"
* This method of finding controllers has been deprecated.
*/
this.allowGlobals = function() {
globals = true;
};


this.$get = ['$injector', '$window', function($injector, $window) {

/**
* @ngdoc service
* @name $controller
* @requires $injector
*
* @param {Function|string} constructor If called with a function then it's considered to be the
*    controller constructor function. Otherwise it's considered to be a string which is used
*    to retrieve the controller constructor using the following steps:
*
*    * check if a controller with given name is registered via `$controllerProvider`
*    * check if evaluating the string on the current scope returns a constructor
*    * if $controllerProvider#allowGlobals, check `window[constructor]` on the global
*      `window` object (deprecated, not recommended)
*
*    The string can use the `controller as property` syntax, where the controller instance is published
*    as the specified property on the `scope`; the `scope` must be injected into `locals` param for this
*    to work correctly.
*
* @param {Object} locals Injection locals for Controller.
* @return {Object} Instance of given controller.
*
* @description
* `$controller` service is responsible for instantiating controllers.
*
* It's just a simple call to {@link auto.$injector $injector}, but extracted into
* a service, so that one can override this service with [BC version](https://gist.github.com/1649788).
*/
return function $controller(expression, locals, later, ident) {
// PRIVATE API:
//   param `later` --- indicates that the controller's constructor is invoked at a later time.
//                     If true, $controller will allocate the object with the correct
//                     prototype chain, but will not invoke the controller until a returned
//                     callback is invoked.
//   param `ident` --- An optional label which overrides the label parsed from the controller
//                     expression, if any.
var instance, match, constructor, identifier;
later = later === true;
if (ident && isString(ident)) {
  identifier = ident;
}

if (isString(expression)) {
  match = expression.match(CNTRL_REG);
  if (!match) {
    throw $controllerMinErr('ctrlfmt',
      'Badly formed controller string \'{0}\'. ' +
      'Must match `__name__ as __id__` or `__name__`.', expression);
  }
  constructor = match[1];
  identifier = identifier || match[3];
  expression = controllers.hasOwnProperty(constructor)
      ? controllers[constructor]
      : getter(locals.$scope, constructor, true) ||
          (globals ? getter($window, constructor, true) : undefined);

  if (!expression) {
    throw $controllerMinErr('ctrlreg',
      'The controller with the name \'{0}\' is not registered.', constructor);
  }

  assertArgFn(expression, constructor, true);
}

if (later) {
  // Instantiate controller later:
  // This machinery is used to create an instance of the object before calling the
  // controller's constructor itself.
  //
  // This allows properties to be added to the controller before the constructor is
  // invoked. Primarily, this is used for isolate scope bindings in $compile.
  //
  // This feature is not intended for use by applications, and is thus not documented
  // publicly.
  // Object creation: http://jsperf.com/create-constructor/2
  var controllerPrototype = (isArray(expression) ?
    expression[expression.length - 1] : expression).prototype;
  instance = Object.create(controllerPrototype || null);

  if (identifier) {
    addIdentifier(locals, identifier, instance, constructor || expression.name);
  }

  return extend(function $controllerInit() {
    var result = $injector.invoke(expression, instance, locals, constructor);
    if (result !== instance && (isObject(result) || isFunction(result))) {
      instance = result;
      if (identifier) {
        // If result changed, re-assign controllerAs value to scope.
        addIdentifier(locals, identifier, instance, constructor || expression.name);
      }
    }
    return instance;
  }, {
    instance: instance,
    identifier: identifier
  });
}

instance = $injector.instantiate(expression, locals, constructor);

if (identifier) {
  addIdentifier(locals, identifier, instance, constructor || expression.name);
}

return instance;
};

function addIdentifier(locals, identifier, instance, name) {
if (!(locals && isObject(locals.$scope))) {
  throw minErr('$controller')('noscp',
    'Cannot export controller \'{0}\' as \'{1}\'! No $scope object provided via `locals`.',
    name, identifier);
}

locals.$scope[identifier] = instance;
}
}];
}

/**
* @ngdoc service
* @name $document
* @requires $window
* @this
*
* @description
* A {@link angular.element jQuery or jqLite} wrapper for the browser's `window.document` object.
*
* @example
<example module="documentExample" name="document">
<file name="index.html">
 <div ng-controller="ExampleController">
   <p>$document title: <b ng-bind="title"></b></p>
   <p>window.document title: <b ng-bind="windowTitle"></b></p>
 </div>
</file>
<file name="script.js">
 angular.module('documentExample', [])
   .controller('ExampleController', ['$scope', '$document', function($scope, $document) {
     $scope.title = $document[0].title;
     $scope.windowTitle = angular.element(window.document)[0].title;
   }]);
</file>
</example>
*/
function $DocumentProvider() {
this.$get = ['$window', function(window) {
return jqLite(window.document);
}];
}


/**
* @private
* @this
* Listens for document visibility change and makes the current status accessible.
*/
function $$IsDocumentHiddenProvider() {
this.$get = ['$document', '$rootScope', function($document, $rootScope) {
var doc = $document[0];
var hidden = doc && doc.hidden;

$document.on('visibilitychange', changeListener);

$rootScope.$on('$destroy', function() {
$document.off('visibilitychange', changeListener);
});

function changeListener() {
hidden = doc.hidden;
}

return function() {
return hidden;
};
}];
}

/**
* @ngdoc service
* @name $exceptionHandler
* @requires ng.$log
* @this
*
* @description
* Any uncaught exception in AngularJS expressions is delegated to this service.
* The default implementation simply delegates to `$log.error` which logs it into
* the browser console.
*
* In unit tests, if `angular-mocks.js` is loaded, this service is overridden by
* {@link ngMock.$exceptionHandler mock $exceptionHandler} which aids in testing.
*
* ## Example:
*
* The example below will overwrite the default `$exceptionHandler` in order to (a) log uncaught
* errors to the backend for later inspection by the developers and (b) to use `$log.warn()` instead
* of `$log.error()`.
*
* ```js
*   angular.
*     module('exceptionOverwrite', []).
*     factory('$exceptionHandler', ['$log', 'logErrorsToBackend', function($log, logErrorsToBackend) {
*       return function myExceptionHandler(exception, cause) {
*         logErrorsToBackend(exception, cause);
*         $log.warn(exception, cause);
*       };
*     }]);
* ```
*
* <hr />
* Note, that code executed in event-listeners (even those registered using jqLite's `on`/`bind`
* methods) does not delegate exceptions to the {@link ng.$exceptionHandler $exceptionHandler}
* (unless executed during a digest).
*
* If you wish, you can manually delegate exceptions, e.g.
* `try { ... } catch(e) { $exceptionHandler(e); }`
*
* @param {Error} exception Exception associated with the error.
* @param {string=} cause Optional information about the context in which
*       the error was thrown.
*
*/
function $ExceptionHandlerProvider() {
this.$get = ['$log', function($log) {
return function(exception, cause) {
$log.error.apply($log, arguments);
};
}];
}

var $$ForceReflowProvider = /** @this */ function() {
this.$get = ['$document', function($document) {
return function(domNode) {
//the line below will force the browser to perform a repaint so
//that all the animated elements within the animation frame will
//be properly updated and drawn on screen. This is required to
//ensure that the preparation animation is properly flushed so that
//the active state picks up from there. DO NOT REMOVE THIS LINE.
//DO NOT OPTIMIZE THIS LINE. THE MINIFIER WILL REMOVE IT OTHERWISE WHICH
//WILL RESULT IN AN UNPREDICTABLE BUG THAT IS VERY HARD TO TRACK DOWN AND
//WILL TAKE YEARS AWAY FROM YOUR LIFE.
if (domNode) {
  if (!domNode.nodeType && domNode instanceof jqLite) {
    domNode = domNode[0];
  }
} else {
  domNode = $document[0].body;
}
return domNode.offsetWidth + 1;
};
}];
};

var APPLICATION_JSON = 'application/json';
var CONTENT_TYPE_APPLICATION_JSON = {'Content-Type': APPLICATION_JSON + ';charset=utf-8'};
var JSON_START = /^\[|^\{(?!\{)/;
var JSON_ENDS = {
'[': /]$/,
'{': /}$/
};
var JSON_PROTECTION_PREFIX = /^\)]\}',?\n/;
var $httpMinErr = minErr('$http');

function serializeValue(v) {
if (isObject(v)) {
return isDate(v) ? v.toISOString() : toJson(v);
}
return v;
}


/** @this */
function $HttpParamSerializerProvider() {
/**
* @ngdoc service
* @name $httpParamSerializer
* @description
*
* Default {@link $http `$http`} params serializer that converts objects to strings
* according to the following rules:
*
* * `{'foo': 'bar'}` results in `foo=bar`
* * `{'foo': Date.now()}` results in `foo=2015-04-01T09%3A50%3A49.262Z` (`toISOString()` and encoded representation of a Date object)
* * `{'foo': ['bar', 'baz']}` results in `foo=bar&foo=baz` (repeated key for each array element)
* * `{'foo': {'bar':'baz'}}` results in `foo=%7B%22bar%22%3A%22baz%22%7D` (stringified and encoded representation of an object)
*
* Note that serializer will sort the request parameters alphabetically.
* */

this.$get = function() {
return function ngParamSerializer(params) {
if (!params) return '';
var parts = [];
forEachSorted(params, function(value, key) {
  if (value === null || isUndefined(value) || isFunction(value)) return;
  if (isArray(value)) {
    forEach(value, function(v) {
      parts.push(encodeUriQuery(key)  + '=' + encodeUriQuery(serializeValue(v)));
    });
  } else {
    parts.push(encodeUriQuery(key) + '=' + encodeUriQuery(serializeValue(value)));
  }
});

return parts.join('&');
};
};
}

/** @this */
function $HttpParamSerializerJQLikeProvider() {
/**
* @ngdoc service
* @name $httpParamSerializerJQLike
*
* @description
*
* Alternative {@link $http `$http`} params serializer that follows
* jQuery's [`param()`](http://api.jquery.com/jquery.param/) method logic.
* The serializer will also sort the params alphabetically.
*
* To use it for serializing `$http` request parameters, set it as the `paramSerializer` property:
*
* ```js
* $http({
*   url: myUrl,
*   method: 'GET',
*   params: myParams,
*   paramSerializer: '$httpParamSerializerJQLike'
* });
* ```
*
* It is also possible to set it as the default `paramSerializer` in the
* {@link $httpProvider#defaults `$httpProvider`}.
*
* Additionally, you can inject the serializer and use it explicitly, for example to serialize
* form data for submission:
*
* ```js
* .controller(function($http, $httpParamSerializerJQLike) {
*   //...
*
*   $http({
*     url: myUrl,
*     method: 'POST',
*     data: $httpParamSerializerJQLike(myData),
*     headers: {
*       'Content-Type': 'application/x-www-form-urlencoded'
*     }
*   });
*
* });
* ```
*
* */
this.$get = function() {
return function jQueryLikeParamSerializer(params) {
if (!params) return '';
var parts = [];
serialize(params, '', true);
return parts.join('&');

function serialize(toSerialize, prefix, topLevel) {
  if (toSerialize === null || isUndefined(toSerialize)) return;
  if (isArray(toSerialize)) {
    forEach(toSerialize, function(value, index) {
      serialize(value, prefix + '[' + (isObject(value) ? index : '') + ']');
    });
  } else if (isObject(toSerialize) && !isDate(toSerialize)) {
    forEachSorted(toSerialize, function(value, key) {
      serialize(value, prefix +
          (topLevel ? '' : '[') +
          key +
          (topLevel ? '' : ']'));
    });
  } else {
    parts.push(encodeUriQuery(prefix) + '=' + encodeUriQuery(serializeValue(toSerialize)));
  }
}
};
};
}

function defaultHttpResponseTransform(data, headers) {
if (isString(data)) {
// Strip json vulnerability protection prefix and trim whitespace
var tempData = data.replace(JSON_PROTECTION_PREFIX, '').trim();

if (tempData) {
var contentType = headers('Content-Type');
var hasJsonContentType = contentType && (contentType.indexOf(APPLICATION_JSON) === 0);

if (hasJsonContentType || isJsonLike(tempData)) {
  try {
    data = fromJson(tempData);
  } catch (e) {
    if (!hasJsonContentType) {
      return data;
    }
    throw $httpMinErr('baddata', 'Data must be a valid JSON object. Received: "{0}". ' +
    'Parse error: "{1}"', data, e);
  }
}
}
}

return data;
}

function isJsonLike(str) {
var jsonStart = str.match(JSON_START);
return jsonStart && JSON_ENDS[jsonStart[0]].test(str);
}

/**
* Parse headers into key value object
*
* @param {string} headers Raw headers as a string
* @returns {Object} Parsed headers as key value object
*/
function parseHeaders(headers) {
var parsed = createMap(), i;

function fillInParsed(key, val) {
if (key) {
parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
}
}

if (isString(headers)) {
forEach(headers.split('\n'), function(line) {
i = line.indexOf(':');
fillInParsed(lowercase(trim(line.substr(0, i))), trim(line.substr(i + 1)));
});
} else if (isObject(headers)) {
forEach(headers, function(headerVal, headerKey) {
fillInParsed(lowercase(headerKey), trim(headerVal));
});
}

return parsed;
}


/**
* Returns a function that provides access to parsed headers.
*
* Headers are lazy parsed when first requested.
* @see parseHeaders
*
* @param {(string|Object)} headers Headers to provide access to.
* @returns {function(string=)} Returns a getter function which if called with:
*
*   - if called with an argument returns a single header value or null
*   - if called with no arguments returns an object containing all headers.
*/
function headersGetter(headers) {
var headersObj;

return function(name) {
if (!headersObj) headersObj =  parseHeaders(headers);

if (name) {
var value = headersObj[lowercase(name)];
if (value === undefined) {
  value = null;
}
return value;
}

return headersObj;
};
}


/**
* Chain all given functions
*
* This function is used for both request and response transforming
*
* @param {*} data Data to transform.
* @param {function(string=)} headers HTTP headers getter fn.
* @param {number} status HTTP status code of the response.
* @param {(Function|Array.<Function>)} fns Function or an array of functions.
* @returns {*} Transformed data.
*/
function transformData(data, headers, status, fns) {
if (isFunction(fns)) {
return fns(data, headers, status);
}

forEach(fns, function(fn) {
data = fn(data, headers, status);
});

return data;
}


function isSuccess(status) {
return 200 <= status && status < 300;
}


/**
* @ngdoc provider
* @name $httpProvider
* @this
*
* @description
* Use `$httpProvider` to change the default behavior of the {@link ng.$http $http} service.
* */
function $HttpProvider() {
/**
* @ngdoc property
* @name $httpProvider#defaults
* @description
*
* Object containing default values for all {@link ng.$http $http} requests.
*
* - **`defaults.cache`** - {boolean|Object} - A boolean value or object created with
* {@link ng.$cacheFactory `$cacheFactory`} to enable or disable caching of HTTP responses
* by default. See {@link $http#caching $http Caching} for more information.
*
* - **`defaults.headers`** - {Object} - Default headers for all $http requests.
* Refer to {@link ng.$http#setting-http-headers $http} for documentation on
* setting default headers.
*     - **`defaults.headers.common`**
*     - **`defaults.headers.post`**
*     - **`defaults.headers.put`**
*     - **`defaults.headers.patch`**
*
* - **`defaults.jsonpCallbackParam`** - `{string}` - the name of the query parameter that passes the name of the
* callback in a JSONP request. The value of this parameter will be replaced with the expression generated by the
* {@link $jsonpCallbacks} service. Defaults to `'callback'`.
*
* - **`defaults.paramSerializer`** - `{string|function(Object<string,string>):string}` - A function
*  used to the prepare string representation of request parameters (specified as an object).
*  If specified as string, it is interpreted as a function registered with the {@link auto.$injector $injector}.
*  Defaults to {@link ng.$httpParamSerializer $httpParamSerializer}.
*
* - **`defaults.transformRequest`** -
* `{Array<function(data, headersGetter)>|function(data, headersGetter)}` -
* An array of functions (or a single function) which are applied to the request data.
* By default, this is an array with one request transformation function:
*
*   - If the `data` property of the request configuration object contains an object, serialize it
*     into JSON format.
*
* - **`defaults.transformResponse`** -
* `{Array<function(data, headersGetter, status)>|function(data, headersGetter, status)}` -
* An array of functions (or a single function) which are applied to the response data. By default,
* this is an array which applies one response transformation function that does two things:
*
*  - If XSRF prefix is detected, strip it
*    (see {@link ng.$http#security-considerations Security Considerations in the $http docs}).
*  - If the `Content-Type` is `application/json` or the response looks like JSON,
*    deserialize it using a JSON parser.
*
* - **`defaults.xsrfCookieName`** - {string} - Name of cookie containing the XSRF token.
* Defaults value is `'XSRF-TOKEN'`.
*
* - **`defaults.xsrfHeaderName`** - {string} - Name of HTTP header to populate with the
* XSRF token. Defaults value is `'X-XSRF-TOKEN'`.
*
**/
var defaults = this.defaults = {
// transform incoming response data
transformResponse: [defaultHttpResponseTransform],

// transform outgoing request data
transformRequest: [function(d) {
return isObject(d) && !isFile(d) && !isBlob(d) && !isFormData(d) ? toJson(d) : d;
}],

// default headers
headers: {
common: {
  'Accept': 'application/json, text/plain, */*'
},
post:   shallowCopy(CONTENT_TYPE_APPLICATION_JSON),
put:    shallowCopy(CONTENT_TYPE_APPLICATION_JSON),
patch:  shallowCopy(CONTENT_TYPE_APPLICATION_JSON)
},

xsrfCookieName: 'XSRF-TOKEN',
xsrfHeaderName: 'X-XSRF-TOKEN',

paramSerializer: '$httpParamSerializer',

jsonpCallbackParam: 'callback'
};

var useApplyAsync = false;
/**
* @ngdoc method
* @name $httpProvider#useApplyAsync
* @description
*
* Configure $http service to combine processing of multiple http responses received at around
* the same time via {@link ng.$rootScope.Scope#$applyAsync $rootScope.$applyAsync}. This can result in
* significant performance improvement for bigger applications that make many HTTP requests
* concurrently (common during application bootstrap).
*
* Defaults to false. If no value is specified, returns the current configured value.
*
* @param {boolean=} value If true, when requests are loaded, they will schedule a deferred
*    "apply" on the next tick, giving time for subsequent requests in a roughly ~10ms window
*    to load and share the same digest cycle.
*
* @returns {boolean|Object} If a value is specified, returns the $httpProvider for chaining.
*    otherwise, returns the current configured value.
**/
this.useApplyAsync = function(value) {
if (isDefined(value)) {
useApplyAsync = !!value;
return this;
}
return useApplyAsync;
};

/**
* @ngdoc property
* @name $httpProvider#interceptors
* @description
*
* Array containing service factories for all synchronous or asynchronous {@link ng.$http $http}
* pre-processing of request or postprocessing of responses.
*
* These service factories are ordered by request, i.e. they are applied in the same order as the
* array, on request, but reverse order, on response.
*
* {@link ng.$http#interceptors Interceptors detailed info}
**/
var interceptorFactories = this.interceptors = [];

this.$get = ['$browser', '$httpBackend', '$$cookieReader', '$cacheFactory', '$rootScope', '$q', '$injector', '$sce',
function($browser, $httpBackend, $$cookieReader, $cacheFactory, $rootScope, $q, $injector, $sce) {

var defaultCache = $cacheFactory('$http');

/**
* Make sure that default param serializer is exposed as a function
*/
defaults.paramSerializer = isString(defaults.paramSerializer) ?
$injector.get(defaults.paramSerializer) : defaults.paramSerializer;

/**
* Interceptors stored in reverse order. Inner interceptors before outer interceptors.
* The reversal is needed so that we can build up the interception chain around the
* server request.
*/
var reversedInterceptors = [];

forEach(interceptorFactories, function(interceptorFactory) {
reversedInterceptors.unshift(isString(interceptorFactory)
    ? $injector.get(interceptorFactory) : $injector.invoke(interceptorFactory));
});

/**
* @ngdoc service
* @kind function
* @name $http
* @requires ng.$httpBackend
* @requires $cacheFactory
* @requires $rootScope
* @requires $q
* @requires $injector
*
* @description
* The `$http` service is a core AngularJS service that facilitates communication with the remote
* HTTP servers via the browser's [XMLHttpRequest](https://developer.mozilla.org/en/xmlhttprequest)
* object or via [JSONP](http://en.wikipedia.org/wiki/JSONP).
*
* For unit testing applications that use `$http` service, see
* {@link ngMock.$httpBackend $httpBackend mock}.
*
* For a higher level of abstraction, please check out the {@link ngResource.$resource
* $resource} service.
*
* The $http API is based on the {@link ng.$q deferred/promise APIs} exposed by
* the $q service. While for simple usage patterns this doesn't matter much, for advanced usage
* it is important to familiarize yourself with these APIs and the guarantees they provide.
*
*
* ## General usage
* The `$http` service is a function which takes a single argument â€” a {@link $http#usage configuration object} â€”
* that is used to generate an HTTP request and returns  a {@link ng.$q promise}.
*
* ```js
*   // Simple GET request example:
*   $http({
*     method: 'GET',
*     url: '/someUrl'
*   }).then(function successCallback(response) {
*       // this callback will be called asynchronously
*       // when the response is available
*     }, function errorCallback(response) {
*       // called asynchronously if an error occurs
*       // or server returns response with an error status.
*     });
* ```
*
* The response object has these properties:
*
*   - **data** â€“ `{string|Object}` â€“ The response body transformed with the transform
*     functions.
*   - **status** â€“ `{number}` â€“ HTTP status code of the response.
*   - **headers** â€“ `{function([headerName])}` â€“ Header getter function.
*   - **config** â€“ `{Object}` â€“ The configuration object that was used to generate the request.
*   - **statusText** â€“ `{string}` â€“ HTTP status text of the response.
*   - **xhrStatus** â€“ `{string}` â€“ Status of the XMLHttpRequest (`complete`, `error`, `timeout` or `abort`).
*
* A response status code between 200 and 299 is considered a success status and will result in
* the success callback being called. Any response status code outside of that range is
* considered an error status and will result in the error callback being called.
* Also, status codes less than -1 are normalized to zero. -1 usually means the request was
* aborted, e.g. using a `config.timeout`.
* Note that if the response is a redirect, XMLHttpRequest will transparently follow it, meaning
* that the outcome (success or error) will be determined by the final response status code.
*
*
* ## Shortcut methods
*
* Shortcut methods are also available. All shortcut methods require passing in the URL, and
* request data must be passed in for POST/PUT requests. An optional config can be passed as the
* last argument.
*
* ```js
*   $http.get('/someUrl', config).then(successCallback, errorCallback);
*   $http.post('/someUrl', data, config).then(successCallback, errorCallback);
* ```
*
* Complete list of shortcut methods:
*
* - {@link ng.$http#get $http.get}
* - {@link ng.$http#head $http.head}
* - {@link ng.$http#post $http.post}
* - {@link ng.$http#put $http.put}
* - {@link ng.$http#delete $http.delete}
* - {@link ng.$http#jsonp $http.jsonp}
* - {@link ng.$http#patch $http.patch}
*
*
* ## Writing Unit Tests that use $http
* When unit testing (using {@link ngMock ngMock}), it is necessary to call
* {@link ngMock.$httpBackend#flush $httpBackend.flush()} to flush each pending
* request using trained responses.
*
* ```
* $httpBackend.expectGET(...);
* $http.get(...);
* $httpBackend.flush();
* ```
*
* ## Setting HTTP Headers
*
* The $http service will automatically add certain HTTP headers to all requests. These defaults
* can be fully configured by accessing the `$httpProvider.defaults.headers` configuration
* object, which currently contains this default configuration:
*
* - `$httpProvider.defaults.headers.common` (headers that are common for all requests):
*   - <code>Accept: application/json, text/plain, \*&#65279;/&#65279;\*</code>
* - `$httpProvider.defaults.headers.post`: (header defaults for POST requests)
*   - `Content-Type: application/json`
* - `$httpProvider.defaults.headers.put` (header defaults for PUT requests)
*   - `Content-Type: application/json`
*
* To add or overwrite these defaults, simply add or remove a property from these configuration
* objects. To add headers for an HTTP method other than POST or PUT, simply add a new object
* with the lowercased HTTP method name as the key, e.g.
* `$httpProvider.defaults.headers.get = { 'My-Header' : 'value' }`.
*
* The defaults can also be set at runtime via the `$http.defaults` object in the same
* fashion. For example:
*
* ```
* module.run(function($http) {
*   $http.defaults.headers.common.Authorization = 'Basic YmVlcDpib29w';
* });
* ```
*
* In addition, you can supply a `headers` property in the config object passed when
* calling `$http(config)`, which overrides the defaults without changing them globally.
*
* To explicitly remove a header automatically added via $httpProvider.defaults.headers on a per request basis,
* Use the `headers` property, setting the desired header to `undefined`. For example:
*
* ```js
* var req = {
*  method: 'POST',
*  url: 'http://example.com',
*  headers: {
*    'Content-Type': undefined
*  },
*  data: { test: 'test' }
* }
*
* $http(req).then(function(){...}, function(){...});
* ```
*
* ## Transforming Requests and Responses
*
* Both requests and responses can be transformed using transformation functions: `transformRequest`
* and `transformResponse`. These properties can be a single function that returns
* the transformed value (`function(data, headersGetter, status)`) or an array of such transformation functions,
* which allows you to `push` or `unshift` a new transformation function into the transformation chain.
*
* <div class="alert alert-warning">
* **Note:** AngularJS does not make a copy of the `data` parameter before it is passed into the `transformRequest` pipeline.
* That means changes to the properties of `data` are not local to the transform function (since Javascript passes objects by reference).
* For example, when calling `$http.get(url, $scope.myObject)`, modifications to the object's properties in a transformRequest
* function will be reflected on the scope and in any templates where the object is data-bound.
* To prevent this, transform functions should have no side-effects.
* If you need to modify properties, it is recommended to make a copy of the data, or create new object to return.
* </div>
*
* ### Default Transformations
*
* The `$httpProvider` provider and `$http` service expose `defaults.transformRequest` and
* `defaults.transformResponse` properties. If a request does not provide its own transformations
* then these will be applied.
*
* You can augment or replace the default transformations by modifying these properties by adding to or
* replacing the array.
*
* AngularJS provides the following default transformations:
*
* Request transformations (`$httpProvider.defaults.transformRequest` and `$http.defaults.transformRequest`) is
* an array with one function that does the following:
*
* - If the `data` property of the request configuration object contains an object, serialize it
*   into JSON format.
*
* Response transformations (`$httpProvider.defaults.transformResponse` and `$http.defaults.transformResponse`) is
* an array with one function that does the following:
*
*  - If XSRF prefix is detected, strip it (see Security Considerations section below).
*  - If the `Content-Type` is `application/json` or the response looks like JSON,
*      deserialize it using a JSON parser.
*
*
* ### Overriding the Default Transformations Per Request
*
* If you wish to override the request/response transformations only for a single request then provide
* `transformRequest` and/or `transformResponse` properties on the configuration object passed
* into `$http`.
*
* Note that if you provide these properties on the config object the default transformations will be
* overwritten. If you wish to augment the default transformations then you must include them in your
* local transformation array.
*
* The following code demonstrates adding a new response transformation to be run after the default response
* transformations have been run.
*
* ```js
* function appendTransform(defaults, transform) {
*
*   // We can't guarantee that the default transformation is an array
*   defaults = angular.isArray(defaults) ? defaults : [defaults];
*
*   // Append the new transformation to the defaults
*   return defaults.concat(transform);
* }
*
* $http({
*   url: '...',
*   method: 'GET',
*   transformResponse: appendTransform($http.defaults.transformResponse, function(value) {
*     return doTransform(value);
*   })
* });
* ```
*
*
* ## Caching
*
* {@link ng.$http `$http`} responses are not cached by default. To enable caching, you must
* set the config.cache value or the default cache value to TRUE or to a cache object (created
* with {@link ng.$cacheFactory `$cacheFactory`}). If defined, the value of config.cache takes
* precedence over the default cache value.
*
* In order to:
*   * cache all responses - set the default cache value to TRUE or to a cache object
*   * cache a specific response - set config.cache value to TRUE or to a cache object
*
* If caching is enabled, but neither the default cache nor config.cache are set to a cache object,
* then the default `$cacheFactory("$http")` object is used.
*
* The default cache value can be set by updating the
* {@link ng.$http#defaults `$http.defaults.cache`} property or the
* {@link $httpProvider#defaults `$httpProvider.defaults.cache`} property.
*
* When caching is enabled, {@link ng.$http `$http`} stores the response from the server using
* the relevant cache object. The next time the same request is made, the response is returned
* from the cache without sending a request to the server.
*
* Take note that:
*
*   * Only GET and JSONP requests are cached.
*   * The cache key is the request URL including search parameters; headers are not considered.
*   * Cached responses are returned asynchronously, in the same way as responses from the server.
*   * If multiple identical requests are made using the same cache, which is not yet populated,
*     one request will be made to the server and remaining requests will return the same response.
*   * A cache-control header on the response does not affect if or how responses are cached.
*
*
* ## Interceptors
*
* Before you start creating interceptors, be sure to understand the
* {@link ng.$q $q and deferred/promise APIs}.
*
* For purposes of global error handling, authentication, or any kind of synchronous or
* asynchronous pre-processing of request or postprocessing of responses, it is desirable to be
* able to intercept requests before they are handed to the server and
* responses before they are handed over to the application code that
* initiated these requests. The interceptors leverage the {@link ng.$q
* promise APIs} to fulfill this need for both synchronous and asynchronous pre-processing.
*
* The interceptors are service factories that are registered with the `$httpProvider` by
* adding them to the `$httpProvider.interceptors` array. The factory is called and
* injected with dependencies (if specified) and returns the interceptor.
*
* There are two kinds of interceptors (and two kinds of rejection interceptors):
*
*   * `request`: interceptors get called with a http {@link $http#usage config} object. The function is free to
*     modify the `config` object or create a new one. The function needs to return the `config`
*     object directly, or a promise containing the `config` or a new `config` object.
*   * `requestError`: interceptor gets called when a previous interceptor threw an error or
*     resolved with a rejection.
*   * `response`: interceptors get called with http `response` object. The function is free to
*     modify the `response` object or create a new one. The function needs to return the `response`
*     object directly, or as a promise containing the `response` or a new `response` object.
*   * `responseError`: interceptor gets called when a previous interceptor threw an error or
*     resolved with a rejection.
*
*
* ```js
*   // register the interceptor as a service
*   $provide.factory('myHttpInterceptor', function($q, dependency1, dependency2) {
*     return {
*       // optional method
*       'request': function(config) {
*         // do something on success
*         return config;
*       },
*
*       // optional method
*      'requestError': function(rejection) {
*         // do something on error
*         if (canRecover(rejection)) {
*           return responseOrNewPromise
*         }
*         return $q.reject(rejection);
*       },
*
*
*
*       // optional method
*       'response': function(response) {
*         // do something on success
*         return response;
*       },
*
*       // optional method
*      'responseError': function(rejection) {
*         // do something on error
*         if (canRecover(rejection)) {
*           return responseOrNewPromise
*         }
*         return $q.reject(rejection);
*       }
*     };
*   });
*
*   $httpProvider.interceptors.push('myHttpInterceptor');
*
*
*   // alternatively, register the interceptor via an anonymous factory
*   $httpProvider.interceptors.push(function($q, dependency1, dependency2) {
*     return {
*      'request': function(config) {
*          // same as above
*       },
*
*       'response': function(response) {
*          // same as above
*       }
*     };
*   });
* ```
*
* ## Security Considerations
*
* When designing web applications, consider security threats from:
*
* - [JSON vulnerability](http://haacked.com/archive/2008/11/20/anatomy-of-a-subtle-json-vulnerability.aspx)
* - [XSRF](http://en.wikipedia.org/wiki/Cross-site_request_forgery)
*
* Both server and the client must cooperate in order to eliminate these threats. AngularJS comes
* pre-configured with strategies that address these issues, but for this to work backend server
* cooperation is required.
*
* ### JSON Vulnerability Protection
*
* A [JSON vulnerability](http://haacked.com/archive/2008/11/20/anatomy-of-a-subtle-json-vulnerability.aspx)
* allows third party website to turn your JSON resource URL into
* [JSONP](http://en.wikipedia.org/wiki/JSONP) request under some conditions. To
* counter this your server can prefix all JSON requests with following string `")]}',\n"`.
* AngularJS will automatically strip the prefix before processing it as JSON.
*
* For example if your server needs to return:
* ```js
* ['one','two']
* ```
*
* which is vulnerable to attack, your server can return:
* ```js
* )]}',
* ['one','two']
* ```
*
* AngularJS will strip the prefix, before processing the JSON.
*
*
* ### Cross Site Request Forgery (XSRF) Protection
*
* [XSRF](http://en.wikipedia.org/wiki/Cross-site_request_forgery) is an attack technique by
* which the attacker can trick an authenticated user into unknowingly executing actions on your
* website. AngularJS provides a mechanism to counter XSRF. When performing XHR requests, the
* $http service reads a token from a cookie (by default, `XSRF-TOKEN`) and sets it as an HTTP
* header (`X-XSRF-TOKEN`). Since only JavaScript that runs on your domain could read the
* cookie, your server can be assured that the XHR came from JavaScript running on your domain.
* The header will not be set for cross-domain requests.
*
* To take advantage of this, your server needs to set a token in a JavaScript readable session
* cookie called `XSRF-TOKEN` on the first HTTP GET request. On subsequent XHR requests the
* server can verify that the cookie matches `X-XSRF-TOKEN` HTTP header, and therefore be sure
* that only JavaScript running on your domain could have sent the request. The token must be
* unique for each user and must be verifiable by the server (to prevent the JavaScript from
* making up its own tokens). We recommend that the token is a digest of your site's
* authentication cookie with a [salt](https://en.wikipedia.org/wiki/Salt_(cryptography&#41;)
* for added security.
*
* The name of the headers can be specified using the xsrfHeaderName and xsrfCookieName
* properties of either $httpProvider.defaults at config-time, $http.defaults at run-time,
* or the per-request config object.
*
* In order to prevent collisions in environments where multiple AngularJS apps share the
* same domain or subdomain, we recommend that each application uses unique cookie name.
*
* @param {object} config Object describing the request to be made and how it should be
*    processed. The object has following properties:
*
*    - **method** â€“ `{string}` â€“ HTTP method (e.g. 'GET', 'POST', etc)
*    - **url** â€“ `{string|TrustedObject}` â€“ Absolute or relative URL of the resource that is being requested;
*      or an object created by a call to `$sce.trustAsResourceUrl(url)`.
*    - **params** â€“ `{Object.<string|Object>}` â€“ Map of strings or objects which will be serialized
*      with the `paramSerializer` and appended as GET parameters.
*    - **data** â€“ `{string|Object}` â€“ Data to be sent as the request message data.
*    - **headers** â€“ `{Object}` â€“ Map of strings or functions which return strings representing
*      HTTP headers to send to the server. If the return value of a function is null, the
*      header will not be sent. Functions accept a config object as an argument.
*    - **eventHandlers** - `{Object}` - Event listeners to be bound to the XMLHttpRequest object.
*      To bind events to the XMLHttpRequest upload object, use `uploadEventHandlers`.
*      The handler will be called in the context of a `$apply` block.
*    - **uploadEventHandlers** - `{Object}` - Event listeners to be bound to the XMLHttpRequest upload
*      object. To bind events to the XMLHttpRequest object, use `eventHandlers`.
*      The handler will be called in the context of a `$apply` block.
*    - **xsrfHeaderName** â€“ `{string}` â€“ Name of HTTP header to populate with the XSRF token.
*    - **xsrfCookieName** â€“ `{string}` â€“ Name of cookie containing the XSRF token.
*    - **transformRequest** â€“
*      `{function(data, headersGetter)|Array.<function(data, headersGetter)>}` â€“
*      transform function or an array of such functions. The transform function takes the http
*      request body and headers and returns its transformed (typically serialized) version.
*      See {@link ng.$http#overriding-the-default-transformations-per-request
*      Overriding the Default Transformations}
*    - **transformResponse** â€“
*      `{function(data, headersGetter, status)|Array.<function(data, headersGetter, status)>}` â€“
*      transform function or an array of such functions. The transform function takes the http
*      response body, headers and status and returns its transformed (typically deserialized) version.
*      See {@link ng.$http#overriding-the-default-transformations-per-request
*      Overriding the Default Transformations}
*    - **paramSerializer** - `{string|function(Object<string,string>):string}` - A function used to
*      prepare the string representation of request parameters (specified as an object).
*      If specified as string, it is interpreted as function registered with the
*      {@link $injector $injector}, which means you can create your own serializer
*      by registering it as a {@link auto.$provide#service service}.
*      The default serializer is the {@link $httpParamSerializer $httpParamSerializer};
*      alternatively, you can use the {@link $httpParamSerializerJQLike $httpParamSerializerJQLike}
*    - **cache** â€“ `{boolean|Object}` â€“ A boolean value or object created with
*      {@link ng.$cacheFactory `$cacheFactory`} to enable or disable caching of the HTTP response.
*      See {@link $http#caching $http Caching} for more information.
*    - **timeout** â€“ `{number|Promise}` â€“ timeout in milliseconds, or {@link ng.$q promise}
*      that should abort the request when resolved.
*    - **withCredentials** - `{boolean}` - whether to set the `withCredentials` flag on the
*      XHR object. See [requests with credentials](https://developer.mozilla.org/docs/Web/HTTP/Access_control_CORS#Requests_with_credentials)
*      for more information.
*    - **responseType** - `{string}` - see
*      [XMLHttpRequest.responseType](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#xmlhttprequest-responsetype).
*
* @returns {HttpPromise} Returns a {@link ng.$q `Promise}` that will be resolved to a response object
*                        when the request succeeds or fails.
*
*
* @property {Array.<Object>} pendingRequests Array of config objects for currently pending
*   requests. This is primarily meant to be used for debugging purposes.
*
*
* @example
<example module="httpExample" name="http-service">
<file name="index.html">
<div ng-controller="FetchController">
<select ng-model="method" aria-label="Request method">
<option>GET</option>
<option>JSONP</option>
</select>
<input type="text" ng-model="url" size="80" aria-label="URL" />
<button id="fetchbtn" ng-click="fetch()">fetch</button><br>
<button id="samplegetbtn" ng-click="updateModel('GET', 'http-hello.html')">Sample GET</button>
<button id="samplejsonpbtn"
ng-click="updateModel('JSONP',
              'https://angularjs.org/greet.php?name=Super%20Hero')">
Sample JSONP
</button>
<button id="invalidjsonpbtn"
ng-click="updateModel('JSONP', 'https://angularjs.org/doesntexist')">
  Invalid JSONP
</button>
<pre>http status code: {{status}}</pre>
<pre>http response data: {{data}}</pre>
</div>
</file>
<file name="script.js">
angular.module('httpExample', [])
.config(['$sceDelegateProvider', function($sceDelegateProvider) {
// We must whitelist the JSONP endpoint that we are using to show that we trust it
$sceDelegateProvider.resourceUrlWhitelist([
  'self',
  'https://angularjs.org/**'
]);
}])
.controller('FetchController', ['$scope', '$http', '$templateCache',
function($scope, $http, $templateCache) {
  $scope.method = 'GET';
  $scope.url = 'http-hello.html';

  $scope.fetch = function() {
    $scope.code = null;
    $scope.response = null;

    $http({method: $scope.method, url: $scope.url, cache: $templateCache}).
      then(function(response) {
        $scope.status = response.status;
        $scope.data = response.data;
      }, function(response) {
        $scope.data = response.data || 'Request failed';
        $scope.status = response.status;
    });
  };

  $scope.updateModel = function(method, url) {
    $scope.method = method;
    $scope.url = url;
  };
}]);
</file>
<file name="http-hello.html">
Hello, $http!
</file>
<file name="protractor.js" type="protractor">
var status = element(by.binding('status'));
var data = element(by.binding('data'));
var fetchBtn = element(by.id('fetchbtn'));
var sampleGetBtn = element(by.id('samplegetbtn'));
var invalidJsonpBtn = element(by.id('invalidjsonpbtn'));

it('should make an xhr GET request', function() {
sampleGetBtn.click();
fetchBtn.click();
expect(status.getText()).toMatch('200');
expect(data.getText()).toMatch(/Hello, \$http!/);
});

// Commented out due to flakes. See https://github.com/angular/angular.js/issues/9185
// it('should make a JSONP request to angularjs.org', function() {
//   var sampleJsonpBtn = element(by.id('samplejsonpbtn'));
//   sampleJsonpBtn.click();
//   fetchBtn.click();
//   expect(status.getText()).toMatch('200');
//   expect(data.getText()).toMatch(/Super Hero!/);
// });

it('should make JSONP request to invalid URL and invoke the error handler',
function() {
invalidJsonpBtn.click();
fetchBtn.click();
expect(status.getText()).toMatch('0');
expect(data.getText()).toMatch('Request failed');
});
</file>
</example>
*/
function $http(requestConfig) {

if (!isObject(requestConfig)) {
  throw minErr('$http')('badreq', 'Http request configuration must be an object.  Received: {0}', requestConfig);
}

if (!isString($sce.valueOf(requestConfig.url))) {
  throw minErr('$http')('badreq', 'Http request configuration url must be a string or a $sce trusted object.  Received: {0}', requestConfig.url);
}

var config = extend({
  method: 'get',
  transformRequest: defaults.transformRequest,
  transformResponse: defaults.transformResponse,
  paramSerializer: defaults.paramSerializer,
  jsonpCallbackParam: defaults.jsonpCallbackParam
}, requestConfig);

config.headers = mergeHeaders(requestConfig);
config.method = uppercase(config.method);
config.paramSerializer = isString(config.paramSerializer) ?
    $injector.get(config.paramSerializer) : config.paramSerializer;

$browser.$$incOutstandingRequestCount();

var requestInterceptors = [];
var responseInterceptors = [];
var promise = $q.resolve(config);

// apply interceptors
forEach(reversedInterceptors, function(interceptor) {
  if (interceptor.request || interceptor.requestError) {
    requestInterceptors.unshift(interceptor.request, interceptor.requestError);
  }
  if (interceptor.response || interceptor.responseError) {
    responseInterceptors.push(interceptor.response, interceptor.responseError);
  }
});

promise = chainInterceptors(promise, requestInterceptors);
promise = promise.then(serverRequest);
promise = chainInterceptors(promise, responseInterceptors);
promise = promise.finally(completeOutstandingRequest);

return promise;


function chainInterceptors(promise, interceptors) {
  for (var i = 0, ii = interceptors.length; i < ii;) {
    var thenFn = interceptors[i++];
    var rejectFn = interceptors[i++];

    promise = promise.then(thenFn, rejectFn);
  }

  interceptors.length = 0;

  return promise;
}

function completeOutstandingRequest() {
  $browser.$$completeOutstandingRequest(noop);
}

function executeHeaderFns(headers, config) {
  var headerContent, processedHeaders = {};

  forEach(headers, function(headerFn, header) {
    if (isFunction(headerFn)) {
      headerContent = headerFn(config);
      if (headerContent != null) {
        processedHeaders[header] = headerContent;
      }
    } else {
      processedHeaders[header] = headerFn;
    }
  });

  return processedHeaders;
}

function mergeHeaders(config) {
  var defHeaders = defaults.headers,
      reqHeaders = extend({}, config.headers),
      defHeaderName, lowercaseDefHeaderName, reqHeaderName;

  defHeaders = extend({}, defHeaders.common, defHeaders[lowercase(config.method)]);

  // using for-in instead of forEach to avoid unnecessary iteration after header has been found
  defaultHeadersIteration:
  for (defHeaderName in defHeaders) {
    lowercaseDefHeaderName = lowercase(defHeaderName);

    for (reqHeaderName in reqHeaders) {
      if (lowercase(reqHeaderName) === lowercaseDefHeaderName) {
        continue defaultHeadersIteration;
      }
    }

    reqHeaders[defHeaderName] = defHeaders[defHeaderName];
  }

  // execute if header value is a function for merged headers
  return executeHeaderFns(reqHeaders, shallowCopy(config));
}

function serverRequest(config) {
  var headers = config.headers;
  var reqData = transformData(config.data, headersGetter(headers), undefined, config.transformRequest);

  // strip content-type if data is undefined
  if (isUndefined(reqData)) {
    forEach(headers, function(value, header) {
      if (lowercase(header) === 'content-type') {
        delete headers[header];
      }
    });
  }

  if (isUndefined(config.withCredentials) && !isUndefined(defaults.withCredentials)) {
    config.withCredentials = defaults.withCredentials;
  }

  // send request
  return sendReq(config, reqData).then(transformResponse, transformResponse);
}

function transformResponse(response) {
  // make a copy since the response must be cacheable
  var resp = extend({}, response);
  resp.data = transformData(response.data, response.headers, response.status,
                            config.transformResponse);
  return (isSuccess(response.status))
    ? resp
    : $q.reject(resp);
}
}

$http.pendingRequests = [];

/**
* @ngdoc method
* @name $http#get
*
* @description
* Shortcut method to perform `GET` request.
*
* @param {string|TrustedObject} url Absolute or relative URL of the resource that is being requested;
*                                   or an object created by a call to `$sce.trustAsResourceUrl(url)`.
* @param {Object=} config Optional configuration object. See https://docs.angularjs.org/api/ng/service/$http#usage
* @returns {HttpPromise} Future object
*/

/**
* @ngdoc method
* @name $http#delete
*
* @description
* Shortcut method to perform `DELETE` request.
*
* @param {string|TrustedObject} url Absolute or relative URL of the resource that is being requested;
*                                   or an object created by a call to `$sce.trustAsResourceUrl(url)`.
* @param {Object=} config Optional configuration object. See https://docs.angularjs.org/api/ng/service/$http#usage
* @returns {HttpPromise} Future object
*/

/**
* @ngdoc method
* @name $http#head
*
* @description
* Shortcut method to perform `HEAD` request.
*
* @param {string|TrustedObject} url Absolute or relative URL of the resource that is being requested;
*                                   or an object created by a call to `$sce.trustAsResourceUrl(url)`.
* @param {Object=} config Optional configuration object. See https://docs.angularjs.org/api/ng/service/$http#usage
* @returns {HttpPromise} Future object
*/

/**
* @ngdoc method
* @name $http#jsonp
*
* @description
* Shortcut method to perform `JSONP` request.
*
* Note that, since JSONP requests are sensitive because the response is given full access to the browser,
* the url must be declared, via {@link $sce} as a trusted resource URL.
* You can trust a URL by adding it to the whitelist via
* {@link $sceDelegateProvider#resourceUrlWhitelist  `$sceDelegateProvider.resourceUrlWhitelist`} or
* by explicitly trusting the URL via {@link $sce#trustAsResourceUrl `$sce.trustAsResourceUrl(url)`}.
*
* You should avoid generating the URL for the JSONP request from user provided data.
* Provide additional query parameters via `params` property of the `config` parameter, rather than
* modifying the URL itself.
*
* JSONP requests must specify a callback to be used in the response from the server. This callback
* is passed as a query parameter in the request. You must specify the name of this parameter by
* setting the `jsonpCallbackParam` property on the request config object.
*
* ```
* $http.jsonp('some/trusted/url', {jsonpCallbackParam: 'callback'})
* ```
*
* You can also specify a default callback parameter name in `$http.defaults.jsonpCallbackParam`.
* Initially this is set to `'callback'`.
*
* <div class="alert alert-danger">
* You can no longer use the `JSON_CALLBACK` string as a placeholder for specifying where the callback
* parameter value should go.
* </div>
*
* If you would like to customise where and how the callbacks are stored then try overriding
* or decorating the {@link $jsonpCallbacks} service.
*
* @param {string|TrustedObject} url Absolute or relative URL of the resource that is being requested;
*                                   or an object created by a call to `$sce.trustAsResourceUrl(url)`.
* @param {Object=} config Optional configuration object. See https://docs.angularjs.org/api/ng/service/$http#usage
* @returns {HttpPromise} Future object
*/
createShortMethods('get', 'delete', 'head', 'jsonp');

/**
* @ngdoc method
* @name $http#post
*
* @description
* Shortcut method to perform `POST` request.
*
* @param {string} url Relative or absolute URL specifying the destination of the request
* @param {*} data Request content
* @param {Object=} config Optional configuration object. See https://docs.angularjs.org/api/ng/service/$http#usage
* @returns {HttpPromise} Future object
*/

/**
* @ngdoc method
* @name $http#put
*
* @description
* Shortcut method to perform `PUT` request.
*
* @param {string} url Relative or absolute URL specifying the destination of the request
* @param {*} data Request content
* @param {Object=} config Optional configuration object. See https://docs.angularjs.org/api/ng/service/$http#usage
* @returns {HttpPromise} Future object
*/

/**
* @ngdoc method
* @name $http#patch
*
* @description
* Shortcut method to perform `PATCH` request.
*
* @param {string} url Relative or absolute URL specifying the destination of the request
* @param {*} data Request content
* @param {Object=} config Optional configuration object. See https://docs.angularjs.org/api/ng/service/$http#usage
* @returns {HttpPromise} Future object
*/
createShortMethodsWithData('post', 'put', 'patch');

  /**
   * @ngdoc property
   * @name $http#defaults
   *
   * @description
   * Runtime equivalent of the `$httpProvider.defaults` property. Allows configuration of
   * default headers, withCredentials as well as request and response transformations.
   *
   * See "Setting HTTP Headers" and "Transforming Requests and Responses" sections above.
   */
$http.defaults = defaults;


return $http;


function createShortMethods(names) {
forEach(arguments, function(name) {
  $http[name] = function(url, config) {
    return $http(extend({}, config || {}, {
      method: name,
      url: url
    }));
  };
});
}


function createShortMethodsWithData(name) {
forEach(arguments, function(name) {
  $http[name] = function(url, data, config) {
    return $http(extend({}, config || {}, {
      method: name,
      url: url,
      data: data
    }));
  };
});
}


/**
* Makes the request.
*
* !!! ACCESSES CLOSURE VARS:
* $httpBackend, defaults, $log, $rootScope, defaultCache, $http.pendingRequests
*/
function sendReq(config, reqData) {
var deferred = $q.defer(),
    promise = deferred.promise,
    cache,
    cachedResp,
    reqHeaders = config.headers,
    isJsonp = lowercase(config.method) === 'jsonp',
    url = config.url;

if (isJsonp) {
  // JSONP is a pretty sensitive operation where we're allowing a script to have full access to
  // our DOM and JS space.  So we require that the URL satisfies SCE.RESOURCE_URL.
  url = $sce.getTrustedResourceUrl(url);
} else if (!isString(url)) {
  // If it is not a string then the URL must be a $sce trusted object
  url = $sce.valueOf(url);
}

url = buildUrl(url, config.paramSerializer(config.params));

if (isJsonp) {
  // Check the url and add the JSONP callback placeholder
  url = sanitizeJsonpCallbackParam(url, config.jsonpCallbackParam);
}

$http.pendingRequests.push(config);
promise.then(removePendingReq, removePendingReq);

if ((config.cache || defaults.cache) && config.cache !== false &&
    (config.method === 'GET' || config.method === 'JSONP')) {
  cache = isObject(config.cache) ? config.cache
      : isObject(/** @type {?} */ (defaults).cache)
        ? /** @type {?} */ (defaults).cache
        : defaultCache;
}

if (cache) {
  cachedResp = cache.get(url);
  if (isDefined(cachedResp)) {
    if (isPromiseLike(cachedResp)) {
      // cached request has already been sent, but there is no response yet
      cachedResp.then(resolvePromiseWithResult, resolvePromiseWithResult);
    } else {
      // serving from cache
      if (isArray(cachedResp)) {
        resolvePromise(cachedResp[1], cachedResp[0], shallowCopy(cachedResp[2]), cachedResp[3], cachedResp[4]);
      } else {
        resolvePromise(cachedResp, 200, {}, 'OK', 'complete');
      }
    }
  } else {
    // put the promise for the non-transformed response into cache as a placeholder
    cache.put(url, promise);
  }
}


// if we won't have the response in cache, set the xsrf headers and
// send the request to the backend
if (isUndefined(cachedResp)) {
  var xsrfValue = urlIsSameOrigin(config.url)
      ? $$cookieReader()[config.xsrfCookieName || defaults.xsrfCookieName]
      : undefined;
  if (xsrfValue) {
    reqHeaders[(config.xsrfHeaderName || defaults.xsrfHeaderName)] = xsrfValue;
  }

  $httpBackend(config.method, url, reqData, done, reqHeaders, config.timeout,
      config.withCredentials, config.responseType,
      createApplyHandlers(config.eventHandlers),
      createApplyHandlers(config.uploadEventHandlers));
}

return promise;

function createApplyHandlers(eventHandlers) {
  if (eventHandlers) {
    var applyHandlers = {};
    forEach(eventHandlers, function(eventHandler, key) {
      applyHandlers[key] = function(event) {
        if (useApplyAsync) {
          $rootScope.$applyAsync(callEventHandler);
        } else if ($rootScope.$$phase) {
          callEventHandler();
        } else {
          $rootScope.$apply(callEventHandler);
        }

        function callEventHandler() {
          eventHandler(event);
        }
      };
    });
    return applyHandlers;
  }
}


/**
 * Callback registered to $httpBackend():
 *  - caches the response if desired
 *  - resolves the raw $http promise
 *  - calls $apply
 */
function done(status, response, headersString, statusText, xhrStatus) {
  if (cache) {
    if (isSuccess(status)) {
      cache.put(url, [status, response, parseHeaders(headersString), statusText, xhrStatus]);
    } else {
      // remove promise from the cache
      cache.remove(url);
    }
  }

  function resolveHttpPromise() {
    resolvePromise(response, status, headersString, statusText, xhrStatus);
  }

  if (useApplyAsync) {
    $rootScope.$applyAsync(resolveHttpPromise);
  } else {
    resolveHttpPromise();
    if (!$rootScope.$$phase) $rootScope.$apply();
  }
}


/**
 * Resolves the raw $http promise.
 */
function resolvePromise(response, status, headers, statusText, xhrStatus) {
  //status: HTTP response status code, 0, -1 (aborted by timeout / promise)
  status = status >= -1 ? status : 0;

  (isSuccess(status) ? deferred.resolve : deferred.reject)({
    data: response,
    status: status,
    headers: headersGetter(headers),
    config: config,
    statusText: statusText,
    xhrStatus: xhrStatus
  });
}

function resolvePromiseWithResult(result) {
  resolvePromise(result.data, result.status, shallowCopy(result.headers()), result.statusText, result.xhrStatus);
}

function removePendingReq() {
  var idx = $http.pendingRequests.indexOf(config);
  if (idx !== -1) $http.pendingRequests.splice(idx, 1);
}
}


function buildUrl(url, serializedParams) {
if (serializedParams.length > 0) {
  url += ((url.indexOf('?') === -1) ? '?' : '&') + serializedParams;
}
return url;
}

function sanitizeJsonpCallbackParam(url, cbKey) {
var parts = url.split('?');
if (parts.length > 2) {
  // Throw if the url contains more than one `?` query indicator
  throw $httpMinErr('badjsonp', 'Illegal use more than one "?", in url, "{1}"', url);
}
var params = parseKeyValue(parts[1]);
forEach(params, function(value, key) {
  if (value === 'JSON_CALLBACK') {
    // Throw if the url already contains a reference to JSON_CALLBACK
    throw $httpMinErr('badjsonp', 'Illegal use of JSON_CALLBACK in url, "{0}"', url);
  }
  if (key === cbKey) {
    // Throw if the callback param was already provided
    throw $httpMinErr('badjsonp', 'Illegal use of callback param, "{0}", in url, "{1}"', cbKey, url);
  }
});

// Add in the JSON_CALLBACK callback param value
url += ((url.indexOf('?') === -1) ? '?' : '&') + cbKey + '=JSON_CALLBACK';

return url;
}
}];
}

/**
* @ngdoc service
* @name $xhrFactory
* @this
*
* @description
* Factory function used to create XMLHttpRequest objects.
*
* Replace or decorate this service to create your own custom XMLHttpRequest objects.
*
* ```
* angular.module('myApp', [])
* .factory('$xhrFactory', function() {
*   return function createXhr(method, url) {
*     return new window.XMLHttpRequest({mozSystem: true});
*   };
* });
* ```
*
* @param {string} method HTTP method of the request (GET, POST, PUT, ..)
* @param {string} url URL of the request.
*/
function $xhrFactoryProvider() {
this.$get = function() {
return function createXhr() {
return new window.XMLHttpRequest();
};
};
}

/**
* @ngdoc service
* @name $httpBackend
* @requires $jsonpCallbacks
* @requires $document
* @requires $xhrFactory
* @this
*
* @description
* HTTP backend used by the {@link ng.$http service} that delegates to
* XMLHttpRequest object or JSONP and deals with browser incompatibilities.
*
* You should never need to use this service directly, instead use the higher-level abstractions:
* {@link ng.$http $http} or {@link ngResource.$resource $resource}.
*
* During testing this implementation is swapped with {@link ngMock.$httpBackend mock
* $httpBackend} which can be trained with responses.
*/
function $HttpBackendProvider() {
this.$get = ['$browser', '$jsonpCallbacks', '$document', '$xhrFactory', function($browser, $jsonpCallbacks, $document, $xhrFactory) {
return createHttpBackend($browser, $xhrFactory, $browser.defer, $jsonpCallbacks, $document[0]);
}];
}

function createHttpBackend($browser, createXhr, $browserDefer, callbacks, rawDocument) {
// TODO(vojta): fix the signature
return function(method, url, post, callback, headers, timeout, withCredentials, responseType, eventHandlers, uploadEventHandlers) {
url = url || $browser.url();

if (lowercase(method) === 'jsonp') {
var callbackPath = callbacks.createCallback(url);
var jsonpDone = jsonpReq(url, callbackPath, function(status, text) {
  // jsonpReq only ever sets status to 200 (OK), 404 (ERROR) or -1 (WAITING)
  var response = (status === 200) && callbacks.getResponse(callbackPath);
  completeRequest(callback, status, response, '', text, 'complete');
  callbacks.removeCallback(callbackPath);
});
} else {

var xhr = createXhr(method, url);

xhr.open(method, url, true);
forEach(headers, function(value, key) {
  if (isDefined(value)) {
      xhr.setRequestHeader(key, value);
  }
});

xhr.onload = function requestLoaded() {
  var statusText = xhr.statusText || '';

  // responseText is the old-school way of retrieving response (supported by IE9)
  // response/responseType properties were introduced in XHR Level2 spec (supported by IE10)
  var response = ('response' in xhr) ? xhr.response : xhr.responseText;

  // normalize IE9 bug (http://bugs.jquery.com/ticket/1450)
  var status = xhr.status === 1223 ? 204 : xhr.status;

  // fix status code when it is 0 (0 status is undocumented).
  // Occurs when accessing file resources or on Android 4.1 stock browser
  // while retrieving files from application cache.
  if (status === 0) {
    status = response ? 200 : urlResolve(url).protocol === 'file' ? 404 : 0;
  }

  completeRequest(callback,
      status,
      response,
      xhr.getAllResponseHeaders(),
      statusText,
      'complete');
};

var requestError = function() {
  // The response is always empty
  // See https://xhr.spec.whatwg.org/#request-error-steps and https://fetch.spec.whatwg.org/#concept-network-error
  completeRequest(callback, -1, null, null, '', 'error');
};

var requestAborted = function() {
  completeRequest(callback, -1, null, null, '', 'abort');
};

var requestTimeout = function() {
  // The response is always empty
  // See https://xhr.spec.whatwg.org/#request-error-steps and https://fetch.spec.whatwg.org/#concept-network-error
  completeRequest(callback, -1, null, null, '', 'timeout');
};

xhr.onerror = requestError;
xhr.onabort = requestAborted;
xhr.ontimeout = requestTimeout;

forEach(eventHandlers, function(value, key) {
    xhr.addEventListener(key, value);
});

forEach(uploadEventHandlers, function(value, key) {
  xhr.upload.addEventListener(key, value);
});

if (withCredentials) {
  xhr.withCredentials = true;
}

if (responseType) {
  try {
    xhr.responseType = responseType;
  } catch (e) {
    // WebKit added support for the json responseType value on 09/03/2013
    // https://bugs.webkit.org/show_bug.cgi?id=73648. Versions of Safari prior to 7 are
    // known to throw when setting the value "json" as the response type. Other older
    // browsers implementing the responseType
    //
    // The json response type can be ignored if not supported, because JSON payloads are
    // parsed on the client-side regardless.
    if (responseType !== 'json') {
      throw e;
    }
  }
}

xhr.send(isUndefined(post) ? null : post);
}

if (timeout > 0) {
var timeoutId = $browserDefer(timeoutRequest, timeout);
} else if (isPromiseLike(timeout)) {
timeout.then(timeoutRequest);
}


function timeoutRequest() {
if (jsonpDone) {
  jsonpDone();
}
if (xhr) {
  xhr.abort();
}
}

function completeRequest(callback, status, response, headersString, statusText, xhrStatus) {
// cancel timeout and subsequent timeout promise resolution
if (isDefined(timeoutId)) {
  $browserDefer.cancel(timeoutId);
}
jsonpDone = xhr = null;

callback(status, response, headersString, statusText, xhrStatus);
}
};

function jsonpReq(url, callbackPath, done) {
url = url.replace('JSON_CALLBACK', callbackPath);
// we can't use jQuery/jqLite here because jQuery does crazy stuff with script elements, e.g.:
// - fetches local scripts via XHR and evals them
// - adds and immediately removes script elements from the document
var script = rawDocument.createElement('script'), callback = null;
script.type = 'text/javascript';
script.src = url;
script.async = true;

callback = function(event) {
script.removeEventListener('load', callback);
script.removeEventListener('error', callback);
rawDocument.body.removeChild(script);
script = null;
var status = -1;
var text = 'unknown';

if (event) {
  if (event.type === 'load' && !callbacks.wasCalled(callbackPath)) {
    event = { type: 'error' };
  }
  text = event.type;
  status = event.type === 'error' ? 404 : 200;
}

if (done) {
  done(status, text);
}
};

script.addEventListener('load', callback);
script.addEventListener('error', callback);
rawDocument.body.appendChild(script);
return callback;
}
}

var $interpolateMinErr = angular.$interpolateMinErr = minErr('$interpolate');
$interpolateMinErr.throwNoconcat = function(text) {
throw $interpolateMinErr('noconcat',
'Error while interpolating: {0}\nStrict Contextual Escaping disallows ' +
'interpolations that concatenate multiple expressions when a trusted value is ' +
'required.  See http://docs.angularjs.org/api/ng.$sce', text);
};

$interpolateMinErr.interr = function(text, err) {
return $interpolateMinErr('interr', 'Can\'t interpolate: {0}\n{1}', text, err.toString());
};

/**
* @ngdoc provider
* @name $interpolateProvider
* @this
*
* @description
*
* Used for configuring the interpolation markup. Defaults to `{{` and `}}`.
*
* <div class="alert alert-danger">
* This feature is sometimes used to mix different markup languages, e.g. to wrap an AngularJS
* template within a Python Jinja template (or any other template language). Mixing templating
* languages is **very dangerous**. The embedding template language will not safely escape AngularJS
* expressions, so any user-controlled values in the template will cause Cross Site Scripting (XSS)
* security bugs!
* </div>
*
* @example
<example name="custom-interpolation-markup" module="customInterpolationApp">
<file name="index.html">
<script>
var customInterpolationApp = angular.module('customInterpolationApp', []);

customInterpolationApp.config(function($interpolateProvider) {
$interpolateProvider.startSymbol('//');
$interpolateProvider.endSymbol('//');
});


customInterpolationApp.controller('DemoController', function() {
this.label = "This binding is brought you by // interpolation symbols.";
});
</script>
<div ng-controller="DemoController as demo">
//demo.label//
</div>
</file>
<file name="protractor.js" type="protractor">
it('should interpolate binding with custom symbols', function() {
expect(element(by.binding('demo.label')).getText()).toBe('This binding is brought you by // interpolation symbols.');
});
</file>
</example>
*/
function $InterpolateProvider() {
var startSymbol = '{{';
var endSymbol = '}}';

/**
* @ngdoc method
* @name $interpolateProvider#startSymbol
* @description
* Symbol to denote start of expression in the interpolated string. Defaults to `{{`.
*
* @param {string=} value new value to set the starting symbol to.
* @returns {string|self} Returns the symbol when used as getter and self if used as setter.
*/
this.startSymbol = function(value) {
if (value) {
startSymbol = value;
return this;
} else {
return startSymbol;
}
};

/**
* @ngdoc method
* @name $interpolateProvider#endSymbol
* @description
* Symbol to denote the end of expression in the interpolated string. Defaults to `}}`.
*
* @param {string=} value new value to set the ending symbol to.
* @returns {string|self} Returns the symbol when used as getter and self if used as setter.
*/
this.endSymbol = function(value) {
if (value) {
endSymbol = value;
return this;
} else {
return endSymbol;
}
};


this.$get = ['$parse', '$exceptionHandler', '$sce', function($parse, $exceptionHandler, $sce) {
var startSymbolLength = startSymbol.length,
  endSymbolLength = endSymbol.length,
  escapedStartRegexp = new RegExp(startSymbol.replace(/./g, escape), 'g'),
  escapedEndRegexp = new RegExp(endSymbol.replace(/./g, escape), 'g');

function escape(ch) {
return '\\\\\\' + ch;
}

function unescapeText(text) {
return text.replace(escapedStartRegexp, startSymbol).
  replace(escapedEndRegexp, endSymbol);
}

// TODO: this is the same as the constantWatchDelegate in parse.js
function constantWatchDelegate(scope, listener, objectEquality, constantInterp) {
var unwatch = scope.$watch(function constantInterpolateWatch(scope) {
  unwatch();
  return constantInterp(scope);
}, listener, objectEquality);
return unwatch;
}

/**
* @ngdoc service
* @name $interpolate
* @kind function
*
* @requires $parse
* @requires $sce
*
* @description
*
* Compiles a string with markup into an interpolation function. This service is used by the
* HTML {@link ng.$compile $compile} service for data binding. See
* {@link ng.$interpolateProvider $interpolateProvider} for configuring the
* interpolation markup.
*
*
* ```js
*   var $interpolate = ...; // injected
*   var exp = $interpolate('Hello {{name | uppercase}}!');
*   expect(exp({name:'AngularJS'})).toEqual('Hello ANGULAR!');
* ```
*
* `$interpolate` takes an optional fourth argument, `allOrNothing`. If `allOrNothing` is
* `true`, the interpolation function will return `undefined` unless all embedded expressions
* evaluate to a value other than `undefined`.
*
* ```js
*   var $interpolate = ...; // injected
*   var context = {greeting: 'Hello', name: undefined };
*
*   // default "forgiving" mode
*   var exp = $interpolate('{{greeting}} {{name}}!');
*   expect(exp(context)).toEqual('Hello !');
*
*   // "allOrNothing" mode
*   exp = $interpolate('{{greeting}} {{name}}!', false, null, true);
*   expect(exp(context)).toBeUndefined();
*   context.name = 'AngularJS';
*   expect(exp(context)).toEqual('Hello AngularJS!');
* ```
*
* `allOrNothing` is useful for interpolating URLs. `ngSrc` and `ngSrcset` use this behavior.
*
* #### Escaped Interpolation
* $interpolate provides a mechanism for escaping interpolation markers. Start and end markers
* can be escaped by preceding each of their characters with a REVERSE SOLIDUS U+005C (backslash).
* It will be rendered as a regular start/end marker, and will not be interpreted as an expression
* or binding.
*
* This enables web-servers to prevent script injection attacks and defacing attacks, to some
* degree, while also enabling code examples to work without relying on the
* {@link ng.directive:ngNonBindable ngNonBindable} directive.
*
* **For security purposes, it is strongly encouraged that web servers escape user-supplied data,
* replacing angle brackets (&lt;, &gt;) with &amp;lt; and &amp;gt; respectively, and replacing all
* interpolation start/end markers with their escaped counterparts.**
*
* Escaped interpolation markers are only replaced with the actual interpolation markers in rendered
* output when the $interpolate service processes the text. So, for HTML elements interpolated
* by {@link ng.$compile $compile}, or otherwise interpolated with the `mustHaveExpression` parameter
* set to `true`, the interpolated text must contain an unescaped interpolation expression. As such,
* this is typically useful only when user-data is used in rendering a template from the server, or
* when otherwise untrusted data is used by a directive.
*
* <example name="interpolation">
*  <file name="index.html">
*    <div ng-init="username='A user'">
*      <p ng-init="apptitle='Escaping demo'">{{apptitle}}: \{\{ username = "defaced value"; \}\}
*        </p>
*      <p><strong>{{username}}</strong> attempts to inject code which will deface the
*        application, but fails to accomplish their task, because the server has correctly
*        escaped the interpolation start/end markers with REVERSE SOLIDUS U+005C (backslash)
*        characters.</p>
*      <p>Instead, the result of the attempted script injection is visible, and can be removed
*        from the database by an administrator.</p>
*    </div>
*  </file>
* </example>
*
* @knownIssue
* It is currently not possible for an interpolated expression to contain the interpolation end
* symbol. For example, `{{ '}}' }}` will be incorrectly interpreted as `{{ ' }}` + `' }}`, i.e.
* an interpolated expression consisting of a single-quote (`'`) and the `' }}` string.
*
* @knownIssue
* All directives and components must use the standard `{{` `}}` interpolation symbols
* in their templates. If you change the application interpolation symbols the {@link $compile}
* service will attempt to denormalize the standard symbols to the custom symbols.
* The denormalization process is not clever enough to know not to replace instances of the standard
* symbols where they would not normally be treated as interpolation symbols. For example in the following
* code snippet the closing braces of the literal object will get incorrectly denormalized:
*
* ```
* <div data-context='{"context":{"id":3,"type":"page"}}">
* ```
*
* The workaround is to ensure that such instances are separated by whitespace:
* ```
* <div data-context='{"context":{"id":3,"type":"page"} }">
* ```
*
* See https://github.com/angular/angular.js/pull/14610#issuecomment-219401099 for more information.
*
* @param {string} text The text with markup to interpolate.
* @param {boolean=} mustHaveExpression if set to true then the interpolation string must have
*    embedded expression in order to return an interpolation function. Strings with no
*    embedded expression will return null for the interpolation function.
* @param {string=} trustedContext when provided, the returned function passes the interpolated
*    result through {@link ng.$sce#getTrusted $sce.getTrusted(interpolatedResult,
*    trustedContext)} before returning it.  Refer to the {@link ng.$sce $sce} service that
*    provides Strict Contextual Escaping for details.
* @param {boolean=} allOrNothing if `true`, then the returned function returns undefined
*    unless all embedded expressions evaluate to a value other than `undefined`.
* @returns {function(context)} an interpolation function which is used to compute the
*    interpolated string. The function has these parameters:
*
* - `context`: evaluation context for all expressions embedded in the interpolated text
*/
function $interpolate(text, mustHaveExpression, trustedContext, allOrNothing) {
// Provide a quick exit and simplified result function for text with no interpolation
if (!text.length || text.indexOf(startSymbol) === -1) {
  var constantInterp;
  if (!mustHaveExpression) {
    var unescapedText = unescapeText(text);
    constantInterp = valueFn(unescapedText);
    constantInterp.exp = text;
    constantInterp.expressions = [];
    constantInterp.$$watchDelegate = constantWatchDelegate;
  }
  return constantInterp;
}

allOrNothing = !!allOrNothing;
var startIndex,
    endIndex,
    index = 0,
    expressions = [],
    parseFns = [],
    textLength = text.length,
    exp,
    concat = [],
    expressionPositions = [];

while (index < textLength) {
  if (((startIndex = text.indexOf(startSymbol, index)) !== -1) &&
       ((endIndex = text.indexOf(endSymbol, startIndex + startSymbolLength)) !== -1)) {
    if (index !== startIndex) {
      concat.push(unescapeText(text.substring(index, startIndex)));
    }
    exp = text.substring(startIndex + startSymbolLength, endIndex);
    expressions.push(exp);
    parseFns.push($parse(exp, parseStringifyInterceptor));
    index = endIndex + endSymbolLength;
    expressionPositions.push(concat.length);
    concat.push('');
  } else {
    // we did not find an interpolation, so we have to add the remainder to the separators array
    if (index !== textLength) {
      concat.push(unescapeText(text.substring(index)));
    }
    break;
  }
}

// Concatenating expressions makes it hard to reason about whether some combination of
// concatenated values are unsafe to use and could easily lead to XSS.  By requiring that a
// single expression be used for iframe[src], object[src], etc., we ensure that the value
// that's used is assigned or constructed by some JS code somewhere that is more testable or
// make it obvious that you bound the value to some user controlled value.  This helps reduce
// the load when auditing for XSS issues.
if (trustedContext && concat.length > 1) {
    $interpolateMinErr.throwNoconcat(text);
}

if (!mustHaveExpression || expressions.length) {
  var compute = function(values) {
    for (var i = 0, ii = expressions.length; i < ii; i++) {
      if (allOrNothing && isUndefined(values[i])) return;
      concat[expressionPositions[i]] = values[i];
    }
    return concat.join('');
  };

  var getValue = function(value) {
    return trustedContext ?
      $sce.getTrusted(trustedContext, value) :
      $sce.valueOf(value);
  };

  return extend(function interpolationFn(context) {
      var i = 0;
      var ii = expressions.length;
      var values = new Array(ii);

      try {
        for (; i < ii; i++) {
          values[i] = parseFns[i](context);
        }

        return compute(values);
      } catch (err) {
        $exceptionHandler($interpolateMinErr.interr(text, err));
      }

    }, {
    // all of these properties are undocumented for now
    exp: text, //just for compatibility with regular watchers created via $watch
    expressions: expressions,
    $$watchDelegate: function(scope, listener) {
      var lastValue;
      return scope.$watchGroup(parseFns, /** @this */ function interpolateFnWatcher(values, oldValues) {
        var currValue = compute(values);
        listener.call(this, currValue, values !== oldValues ? lastValue : currValue, scope);
        lastValue = currValue;
      });
    }
  });
}

function parseStringifyInterceptor(value) {
  try {
    value = getValue(value);
    return allOrNothing && !isDefined(value) ? value : stringify(value);
  } catch (err) {
    $exceptionHandler($interpolateMinErr.interr(text, err));
  }
}
}


/**
* @ngdoc method
* @name $interpolate#startSymbol
* @description
* Symbol to denote the start of expression in the interpolated string. Defaults to `{{`.
*
* Use {@link ng.$interpolateProvider#startSymbol `$interpolateProvider.startSymbol`} to change
* the symbol.
*
* @returns {string} start symbol.
*/
$interpolate.startSymbol = function() {
return startSymbol;
};


/**
* @ngdoc method
* @name $interpolate#endSymbol
* @description
* Symbol to denote the end of expression in the interpolated string. Defaults to `}}`.
*
* Use {@link ng.$interpolateProvider#endSymbol `$interpolateProvider.endSymbol`} to change
* the symbol.
*
* @returns {string} end symbol.
*/
$interpolate.endSymbol = function() {
return endSymbol;
};

return $interpolate;
}];
}

/** @this */
function $IntervalProvider() {
this.$get = ['$rootScope', '$window', '$q', '$$q', '$browser',
 function($rootScope,   $window,   $q,   $$q,   $browser) {
var intervals = {};


/**
* @ngdoc service
* @name $interval
*
* @description
* AngularJS's wrapper for `window.setInterval`. The `fn` function is executed every `delay`
* milliseconds.
*
* The return value of registering an interval function is a promise. This promise will be
* notified upon each tick of the interval, and will be resolved after `count` iterations, or
* run indefinitely if `count` is not defined. The value of the notification will be the
* number of iterations that have run.
* To cancel an interval, call `$interval.cancel(promise)`.
*
* In tests you can use {@link ngMock.$interval#flush `$interval.flush(millis)`} to
* move forward by `millis` milliseconds and trigger any functions scheduled to run in that
* time.
*
* <div class="alert alert-warning">
* **Note**: Intervals created by this service must be explicitly destroyed when you are finished
* with them.  In particular they are not automatically destroyed when a controller's scope or a
* directive's element are destroyed.
* You should take this into consideration and make sure to always cancel the interval at the
* appropriate moment.  See the example below for more details on how and when to do this.
* </div>
*
* @param {function()} fn A function that should be called repeatedly. If no additional arguments
*   are passed (see below), the function is called with the current iteration count.
* @param {number} delay Number of milliseconds between each function call.
* @param {number=} [count=0] Number of times to repeat. If not set, or 0, will repeat
*   indefinitely.
* @param {boolean=} [invokeApply=true] If set to `false` skips model dirty checking, otherwise
*   will invoke `fn` within the {@link ng.$rootScope.Scope#$apply $apply} block.
* @param {...*=} Pass additional parameters to the executed function.
* @returns {promise} A promise which will be notified on each iteration. It will resolve once all iterations of the interval complete.
*
* @example
* <example module="intervalExample" name="interval-service">
* <file name="index.html">
*   <script>
*     angular.module('intervalExample', [])
*       .controller('ExampleController', ['$scope', '$interval',
*         function($scope, $interval) {
*           $scope.format = 'M/d/yy h:mm:ss a';
*           $scope.blood_1 = 100;
*           $scope.blood_2 = 120;
*
*           var stop;
*           $scope.fight = function() {
*             // Don't start a new fight if we are already fighting
*             if ( angular.isDefined(stop) ) return;
*
*             stop = $interval(function() {
*               if ($scope.blood_1 > 0 && $scope.blood_2 > 0) {
*                 $scope.blood_1 = $scope.blood_1 - 3;
*                 $scope.blood_2 = $scope.blood_2 - 4;
*               } else {
*                 $scope.stopFight();
*               }
*             }, 100);
*           };
*
*           $scope.stopFight = function() {
*             if (angular.isDefined(stop)) {
*               $interval.cancel(stop);
*               stop = undefined;
*             }
*           };
*
*           $scope.resetFight = function() {
*             $scope.blood_1 = 100;
*             $scope.blood_2 = 120;
*           };
*
*           $scope.$on('$destroy', function() {
*             // Make sure that the interval is destroyed too
*             $scope.stopFight();
*           });
*         }])
*       // Register the 'myCurrentTime' directive factory method.
*       // We inject $interval and dateFilter service since the factory method is DI.
*       .directive('myCurrentTime', ['$interval', 'dateFilter',
*         function($interval, dateFilter) {
*           // return the directive link function. (compile function not needed)
*           return function(scope, element, attrs) {
*             var format,  // date format
*                 stopTime; // so that we can cancel the time updates
*
*             // used to update the UI
*             function updateTime() {
*               element.text(dateFilter(new Date(), format));
*             }
*
*             // watch the expression, and update the UI on change.
*             scope.$watch(attrs.myCurrentTime, function(value) {
*               format = value;
*               updateTime();
*             });
*
*             stopTime = $interval(updateTime, 1000);
*
*             // listen on DOM destroy (removal) event, and cancel the next UI update
*             // to prevent updating time after the DOM element was removed.
*             element.on('$destroy', function() {
*               $interval.cancel(stopTime);
*             });
*           }
*         }]);
*   </script>
*
*   <div>
*     <div ng-controller="ExampleController">
*       <label>Date format: <input ng-model="format"></label> <hr/>
*       Current time is: <span my-current-time="format"></span>
*       <hr/>
*       Blood 1 : <font color='red'>{{blood_1}}</font>
*       Blood 2 : <font color='red'>{{blood_2}}</font>
*       <button type="button" data-ng-click="fight()">Fight</button>
*       <button type="button" data-ng-click="stopFight()">StopFight</button>
*       <button type="button" data-ng-click="resetFight()">resetFight</button>
*     </div>
*   </div>
*
* </file>
* </example>
*/
function interval(fn, delay, count, invokeApply) {
var hasParams = arguments.length > 4,
    args = hasParams ? sliceArgs(arguments, 4) : [],
    setInterval = $window.setInterval,
    clearInterval = $window.clearInterval,
    iteration = 0,
    skipApply = (isDefined(invokeApply) && !invokeApply),
    deferred = (skipApply ? $$q : $q).defer(),
    promise = deferred.promise;

count = isDefined(count) ? count : 0;

promise.$$intervalId = setInterval(function tick() {
  if (skipApply) {
    $browser.defer(callback);
  } else {
    $rootScope.$evalAsync(callback);
  }
  deferred.notify(iteration++);

  if (count > 0 && iteration >= count) {
    deferred.resolve(iteration);
    clearInterval(promise.$$intervalId);
    delete intervals[promise.$$intervalId];
  }

  if (!skipApply) $rootScope.$apply();

}, delay);

intervals[promise.$$intervalId] = deferred;

return promise;

function callback() {
  if (!hasParams) {
    fn(iteration);
  } else {
    fn.apply(null, args);
  }
}
}


/**
* @ngdoc method
* @name $interval#cancel
*
* @description
* Cancels a task associated with the `promise`.
*
* @param {Promise=} promise returned by the `$interval` function.
* @returns {boolean} Returns `true` if the task was successfully canceled.
*/
interval.cancel = function(promise) {
if (promise && promise.$$intervalId in intervals) {
  // Interval cancels should not report as unhandled promise.
  markQExceptionHandled(intervals[promise.$$intervalId].promise);
  intervals[promise.$$intervalId].reject('canceled');
  $window.clearInterval(promise.$$intervalId);
  delete intervals[promise.$$intervalId];
  return true;
}
return false;
};

return interval;
}];
}

/**
* @ngdoc service
* @name $jsonpCallbacks
* @requires $window
* @description
* This service handles the lifecycle of callbacks to handle JSONP requests.
* Override this service if you wish to customise where the callbacks are stored and
* how they vary compared to the requested url.
*/
var $jsonpCallbacksProvider = /** @this */ function() {
this.$get = function() {
var callbacks = angular.callbacks;
var callbackMap = {};

function createCallback(callbackId) {
var callback = function(data) {
  callback.data = data;
  callback.called = true;
};
callback.id = callbackId;
return callback;
}

return {
/**
 * @ngdoc method
 * @name $jsonpCallbacks#createCallback
 * @param {string} url the url of the JSONP request
 * @returns {string} the callback path to send to the server as part of the JSONP request
 * @description
 * {@link $httpBackend} calls this method to create a callback and get hold of the path to the callback
 * to pass to the server, which will be used to call the callback with its payload in the JSONP response.
 */
createCallback: function(url) {
  var callbackId = '_' + (callbacks.$$counter++).toString(36);
  var callbackPath = 'angular.callbacks.' + callbackId;
  var callback = createCallback(callbackId);
  callbackMap[callbackPath] = callbacks[callbackId] = callback;
  return callbackPath;
},
/**
 * @ngdoc method
 * @name $jsonpCallbacks#wasCalled
 * @param {string} callbackPath the path to the callback that was sent in the JSONP request
 * @returns {boolean} whether the callback has been called, as a result of the JSONP response
 * @description
 * {@link $httpBackend} calls this method to find out whether the JSONP response actually called the
 * callback that was passed in the request.
 */
wasCalled: function(callbackPath) {
  return callbackMap[callbackPath].called;
},
/**
 * @ngdoc method
 * @name $jsonpCallbacks#getResponse
 * @param {string} callbackPath the path to the callback that was sent in the JSONP request
 * @returns {*} the data received from the response via the registered callback
 * @description
 * {@link $httpBackend} calls this method to get hold of the data that was provided to the callback
 * in the JSONP response.
 */
getResponse: function(callbackPath) {
  return callbackMap[callbackPath].data;
},
/**
 * @ngdoc method
 * @name $jsonpCallbacks#removeCallback
 * @param {string} callbackPath the path to the callback that was sent in the JSONP request
 * @description
 * {@link $httpBackend} calls this method to remove the callback after the JSONP request has
 * completed or timed-out.
 */
removeCallback: function(callbackPath) {
  var callback = callbackMap[callbackPath];
  delete callbacks[callback.id];
  delete callbackMap[callbackPath];
}
};
};
};

/**
* @ngdoc service
* @name $locale
*
* @description
* $locale service provides localization rules for various AngularJS components. As of right now the
* only public api is:
*
* * `id` â€“ `{string}` â€“ locale id formatted as `languageId-countryId` (e.g. `en-us`)
*/

var PATH_MATCH = /^([^?#]*)(\?([^#]*))?(#(.*))?$/,
DEFAULT_PORTS = {'http': 80, 'https': 443, 'ftp': 21};
var $locationMinErr = minErr('$location');


/**
* Encode path using encodeUriSegment, ignoring forward slashes
*
* @param {string} path Path to encode
* @returns {string}
*/
function encodePath(path) {
var segments = path.split('/'),
i = segments.length;

while (i--) {
// decode forward slashes to prevent them from being double encoded
segments[i] = encodeUriSegment(segments[i].replace(/%2F/g, '/'));
}

return segments.join('/');
}

function decodePath(path, html5Mode) {
var segments = path.split('/'),
i = segments.length;

while (i--) {
segments[i] = decodeURIComponent(segments[i]);
if (html5Mode) {
// encode forward slashes to prevent them from being mistaken for path separators
segments[i] = segments[i].replace(/\//g, '%2F');
}
}

return segments.join('/');
}

function parseAbsoluteUrl(absoluteUrl, locationObj) {
var parsedUrl = urlResolve(absoluteUrl);

locationObj.$$protocol = parsedUrl.protocol;
locationObj.$$host = parsedUrl.hostname;
locationObj.$$port = toInt(parsedUrl.port) || DEFAULT_PORTS[parsedUrl.protocol] || null;
}

var DOUBLE_SLASH_REGEX = /^\s*[\\/]{2,}/;
function parseAppUrl(url, locationObj, html5Mode) {

if (DOUBLE_SLASH_REGEX.test(url)) {
throw $locationMinErr('badpath', 'Invalid url "{0}".', url);
}

var prefixed = (url.charAt(0) !== '/');
if (prefixed) {
url = '/' + url;
}
var match = urlResolve(url);
var path = prefixed && match.pathname.charAt(0) === '/' ? match.pathname.substring(1) : match.pathname;
locationObj.$$path = decodePath(path, html5Mode);
locationObj.$$search = parseKeyValue(match.search);
locationObj.$$hash = decodeURIComponent(match.hash);

// make sure path starts with '/';
if (locationObj.$$path && locationObj.$$path.charAt(0) !== '/') {
locationObj.$$path = '/' + locationObj.$$path;
}
}

function startsWith(str, search) {
return str.slice(0, search.length) === search;
}

/**
*
* @param {string} base
* @param {string} url
* @returns {string} returns text from `url` after `base` or `undefined` if it does not begin with
*                   the expected string.
*/
function stripBaseUrl(base, url) {
if (startsWith(url, base)) {
return url.substr(base.length);
}
}


function stripHash(url) {
var index = url.indexOf('#');
return index === -1 ? url : url.substr(0, index);
}

function trimEmptyHash(url) {
return url.replace(/(#.+)|#$/, '$1');
}


function stripFile(url) {
return url.substr(0, stripHash(url).lastIndexOf('/') + 1);
}

/* return the server only (scheme://host:port) */
function serverBase(url) {
return url.substring(0, url.indexOf('/', url.indexOf('//') + 2));
}


/**
* LocationHtml5Url represents a URL
* This object is exposed as $location service when HTML5 mode is enabled and supported
*
* @constructor
* @param {string} appBase application base URL
* @param {string} appBaseNoFile application base URL stripped of any filename
* @param {string} basePrefix URL path prefix
*/
function LocationHtml5Url(appBase, appBaseNoFile, basePrefix) {
this.$$html5 = true;
basePrefix = basePrefix || '';
parseAbsoluteUrl(appBase, this);


/**
* Parse given HTML5 (regular) URL string into properties
* @param {string} url HTML5 URL
* @private
*/
this.$$parse = function(url) {
var pathUrl = stripBaseUrl(appBaseNoFile, url);
if (!isString(pathUrl)) {
throw $locationMinErr('ipthprfx', 'Invalid url "{0}", missing path prefix "{1}".', url,
    appBaseNoFile);
}

parseAppUrl(pathUrl, this, true);

if (!this.$$path) {
this.$$path = '/';
}

this.$$compose();
};

/**
* Compose url and update `absUrl` property
* @private
*/
this.$$compose = function() {
var search = toKeyValue(this.$$search),
  hash = this.$$hash ? '#' + encodeUriSegment(this.$$hash) : '';

this.$$url = encodePath(this.$$path) + (search ? '?' + search : '') + hash;
this.$$absUrl = appBaseNoFile + this.$$url.substr(1); // first char is always '/'

this.$$urlUpdatedByLocation = true;
};

this.$$parseLinkUrl = function(url, relHref) {
if (relHref && relHref[0] === '#') {
// special case for links to hash fragments:
// keep the old url and only replace the hash fragment
this.hash(relHref.slice(1));
return true;
}
var appUrl, prevAppUrl;
var rewrittenUrl;


if (isDefined(appUrl = stripBaseUrl(appBase, url))) {
prevAppUrl = appUrl;
if (basePrefix && isDefined(appUrl = stripBaseUrl(basePrefix, appUrl))) {
  rewrittenUrl = appBaseNoFile + (stripBaseUrl('/', appUrl) || appUrl);
} else {
  rewrittenUrl = appBase + prevAppUrl;
}
} else if (isDefined(appUrl = stripBaseUrl(appBaseNoFile, url))) {
rewrittenUrl = appBaseNoFile + appUrl;
} else if (appBaseNoFile === url + '/') {
rewrittenUrl = appBaseNoFile;
}
if (rewrittenUrl) {
this.$$parse(rewrittenUrl);
}
return !!rewrittenUrl;
};
}


/**
* LocationHashbangUrl represents URL
* This object is exposed as $location service when developer doesn't opt into html5 mode.
* It also serves as the base class for html5 mode fallback on legacy browsers.
*
* @constructor
* @param {string} appBase application base URL
* @param {string} appBaseNoFile application base URL stripped of any filename
* @param {string} hashPrefix hashbang prefix
*/
function LocationHashbangUrl(appBase, appBaseNoFile, hashPrefix) {

parseAbsoluteUrl(appBase, this);


/**
* Parse given hashbang URL into properties
* @param {string} url Hashbang URL
* @private
*/
this.$$parse = function(url) {
var withoutBaseUrl = stripBaseUrl(appBase, url) || stripBaseUrl(appBaseNoFile, url);
var withoutHashUrl;

if (!isUndefined(withoutBaseUrl) && withoutBaseUrl.charAt(0) === '#') {

// The rest of the URL starts with a hash so we have
// got either a hashbang path or a plain hash fragment
withoutHashUrl = stripBaseUrl(hashPrefix, withoutBaseUrl);
if (isUndefined(withoutHashUrl)) {
  // There was no hashbang prefix so we just have a hash fragment
  withoutHashUrl = withoutBaseUrl;
}

} else {
// There was no hashbang path nor hash fragment:
// If we are in HTML5 mode we use what is left as the path;
// Otherwise we ignore what is left
if (this.$$html5) {
  withoutHashUrl = withoutBaseUrl;
} else {
  withoutHashUrl = '';
  if (isUndefined(withoutBaseUrl)) {
    appBase = url;
    /** @type {?} */ (this).replace();
  }
}
}

parseAppUrl(withoutHashUrl, this, false);

this.$$path = removeWindowsDriveName(this.$$path, withoutHashUrl, appBase);

this.$$compose();

/*
* In Windows, on an anchor node on documents loaded from
* the filesystem, the browser will return a pathname
* prefixed with the drive name ('/C:/path') when a
* pathname without a drive is set:
*  * a.setAttribute('href', '/foo')
*   * a.pathname === '/C:/foo' //true
*
* Inside of AngularJS, we're always using pathnames that
* do not include drive names for routing.
*/
function removeWindowsDriveName(path, url, base) {
/*
Matches paths for file protocol on windows,
such as /C:/foo/bar, and captures only /foo/bar.
*/
var windowsFilePathExp = /^\/[A-Z]:(\/.*)/;

var firstPathSegmentMatch;

//Get the relative path from the input URL.
if (startsWith(url, base)) {
  url = url.replace(base, '');
}

// The input URL intentionally contains a first path segment that ends with a colon.
if (windowsFilePathExp.exec(url)) {
  return path;
}

firstPathSegmentMatch = windowsFilePathExp.exec(path);
return firstPathSegmentMatch ? firstPathSegmentMatch[1] : path;
}
};

/**
* Compose hashbang URL and update `absUrl` property
* @private
*/
this.$$compose = function() {
var search = toKeyValue(this.$$search),
  hash = this.$$hash ? '#' + encodeUriSegment(this.$$hash) : '';

this.$$url = encodePath(this.$$path) + (search ? '?' + search : '') + hash;
this.$$absUrl = appBase + (this.$$url ? hashPrefix + this.$$url : '');

this.$$urlUpdatedByLocation = true;
};

this.$$parseLinkUrl = function(url, relHref) {
if (stripHash(appBase) === stripHash(url)) {
this.$$parse(url);
return true;
}
return false;
};
}


/**
* LocationHashbangUrl represents URL
* This object is exposed as $location service when html5 history api is enabled but the browser
* does not support it.
*
* @constructor
* @param {string} appBase application base URL
* @param {string} appBaseNoFile application base URL stripped of any filename
* @param {string} hashPrefix hashbang prefix
*/
function LocationHashbangInHtml5Url(appBase, appBaseNoFile, hashPrefix) {
this.$$html5 = true;
LocationHashbangUrl.apply(this, arguments);

this.$$parseLinkUrl = function(url, relHref) {
if (relHref && relHref[0] === '#') {
// special case for links to hash fragments:
// keep the old url and only replace the hash fragment
this.hash(relHref.slice(1));
return true;
}

var rewrittenUrl;
var appUrl;

if (appBase === stripHash(url)) {
rewrittenUrl = url;
} else if ((appUrl = stripBaseUrl(appBaseNoFile, url))) {
rewrittenUrl = appBase + hashPrefix + appUrl;
} else if (appBaseNoFile === url + '/') {
rewrittenUrl = appBaseNoFile;
}
if (rewrittenUrl) {
this.$$parse(rewrittenUrl);
}
return !!rewrittenUrl;
};

this.$$compose = function() {
var search = toKeyValue(this.$$search),
  hash = this.$$hash ? '#' + encodeUriSegment(this.$$hash) : '';

this.$$url = encodePath(this.$$path) + (search ? '?' + search : '') + hash;
// include hashPrefix in $$absUrl when $$url is empty so IE9 does not reload page because of removal of '#'
this.$$absUrl = appBase + hashPrefix + this.$$url;

this.$$urlUpdatedByLocation = true;
};

}


var locationPrototype = {

/**
* Ensure absolute URL is initialized.
* @private
*/
$$absUrl:'',

/**
* Are we in html5 mode?
* @private
*/
$$html5: false,

/**
* Has any change been replacing?
* @private
*/
$$replace: false,

/**
* @ngdoc method
* @name $location#absUrl
*
* @description
* This method is getter only.
*
* Return full URL representation with all segments encoded according to rules specified in
* [RFC 3986](http://www.ietf.org/rfc/rfc3986.txt).
*
*
* ```js
* // given URL http://example.com/#/some/path?foo=bar&baz=xoxo
* var absUrl = $location.absUrl();
* // => "http://example.com/#/some/path?foo=bar&baz=xoxo"
* ```
*
* @return {string} full URL
*/
absUrl: locationGetter('$$absUrl'),

/**
* @ngdoc method
* @name $location#url
*
* @description
* This method is getter / setter.
*
* Return URL (e.g. `/path?a=b#hash`) when called without any parameter.
*
* Change path, search and hash, when called with parameter and return `$location`.
*
*
* ```js
* // given URL http://example.com/#/some/path?foo=bar&baz=xoxo
* var url = $location.url();
* // => "/some/path?foo=bar&baz=xoxo"
* ```
*
* @param {string=} url New URL without base prefix (e.g. `/path?a=b#hash`)
* @return {string} url
*/
url: function(url) {
if (isUndefined(url)) {
return this.$$url;
}

var match = PATH_MATCH.exec(url);
if (match[1] || url === '') this.path(decodeURIComponent(match[1]));
if (match[2] || match[1] || url === '') this.search(match[3] || '');
this.hash(match[5] || '');

return this;
},

/**
* @ngdoc method
* @name $location#protocol
*
* @description
* This method is getter only.
*
* Return protocol of current URL.
*
*
* ```js
* // given URL http://example.com/#/some/path?foo=bar&baz=xoxo
* var protocol = $location.protocol();
* // => "http"
* ```
*
* @return {string} protocol of current URL
*/
protocol: locationGetter('$$protocol'),

/**
* @ngdoc method
* @name $location#host
*
* @description
* This method is getter only.
*
* Return host of current URL.
*
* Note: compared to the non-AngularJS version `location.host` which returns `hostname:port`, this returns the `hostname` portion only.
*
*
* ```js
* // given URL http://example.com/#/some/path?foo=bar&baz=xoxo
* var host = $location.host();
* // => "example.com"
*
* // given URL http://user:password@example.com:8080/#/some/path?foo=bar&baz=xoxo
* host = $location.host();
* // => "example.com"
* host = location.host;
* // => "example.com:8080"
* ```
*
* @return {string} host of current URL.
*/
host: locationGetter('$$host'),

/**
* @ngdoc method
* @name $location#port
*
* @description
* This method is getter only.
*
* Return port of current URL.
*
*
* ```js
* // given URL http://example.com/#/some/path?foo=bar&baz=xoxo
* var port = $location.port();
* // => 80
* ```
*
* @return {Number} port
*/
port: locationGetter('$$port'),

/**
* @ngdoc method
* @name $location#path
*
* @description
* This method is getter / setter.
*
* Return path of current URL when called without any parameter.
*
* Change path when called with parameter and return `$location`.
*
* Note: Path should always begin with forward slash (/), this method will add the forward slash
* if it is missing.
*
*
* ```js
* // given URL http://example.com/#/some/path?foo=bar&baz=xoxo
* var path = $location.path();
* // => "/some/path"
* ```
*
* @param {(string|number)=} path New path
* @return {(string|object)} path if called with no parameters, or `$location` if called with a parameter
*/
path: locationGetterSetter('$$path', function(path) {
path = path !== null ? path.toString() : '';
return path.charAt(0) === '/' ? path : '/' + path;
}),

/**
* @ngdoc method
* @name $location#search
*
* @description
* This method is getter / setter.
*
* Return search part (as object) of current URL when called without any parameter.
*
* Change search part when called with parameter and return `$location`.
*
*
* ```js
* // given URL http://example.com/#/some/path?foo=bar&baz=xoxo
* var searchObject = $location.search();
* // => {foo: 'bar', baz: 'xoxo'}
*
* // set foo to 'yipee'
* $location.search('foo', 'yipee');
* // $location.search() => {foo: 'yipee', baz: 'xoxo'}
* ```
*
* @param {string|Object.<string>|Object.<Array.<string>>} search New search params - string or
* hash object.
*
* When called with a single argument the method acts as a setter, setting the `search` component
* of `$location` to the specified value.
*
* If the argument is a hash object containing an array of values, these values will be encoded
* as duplicate search parameters in the URL.
*
* @param {(string|Number|Array<string>|boolean)=} paramValue If `search` is a string or number, then `paramValue`
* will override only a single search property.
*
* If `paramValue` is an array, it will override the property of the `search` component of
* `$location` specified via the first argument.
*
* If `paramValue` is `null`, the property specified via the first argument will be deleted.
*
* If `paramValue` is `true`, the property specified via the first argument will be added with no
* value nor trailing equal sign.
*
* @return {Object} If called with no arguments returns the parsed `search` object. If called with
* one or more arguments returns `$location` object itself.
*/
search: function(search, paramValue) {
switch (arguments.length) {
case 0:
  return this.$$search;
case 1:
  if (isString(search) || isNumber(search)) {
    search = search.toString();
    this.$$search = parseKeyValue(search);
  } else if (isObject(search)) {
    search = copy(search, {});
    // remove object undefined or null properties
    forEach(search, function(value, key) {
      if (value == null) delete search[key];
    });

    this.$$search = search;
  } else {
    throw $locationMinErr('isrcharg',
        'The first argument of the `$location#search()` call must be a string or an object.');
  }
  break;
default:
  if (isUndefined(paramValue) || paramValue === null) {
    delete this.$$search[search];
  } else {
    this.$$search[search] = paramValue;
  }
}

this.$$compose();
return this;
},

/**
* @ngdoc method
* @name $location#hash
*
* @description
* This method is getter / setter.
*
* Returns the hash fragment when called without any parameters.
*
* Changes the hash fragment when called with a parameter and returns `$location`.
*
*
* ```js
* // given URL http://example.com/#/some/path?foo=bar&baz=xoxo#hashValue
* var hash = $location.hash();
* // => "hashValue"
* ```
*
* @param {(string|number)=} hash New hash fragment
* @return {string} hash
*/
hash: locationGetterSetter('$$hash', function(hash) {
return hash !== null ? hash.toString() : '';
}),

/**
* @ngdoc method
* @name $location#replace
*
* @description
* If called, all changes to $location during the current `$digest` will replace the current history
* record, instead of adding a new one.
*/
replace: function() {
this.$$replace = true;
return this;
}
};

forEach([LocationHashbangInHtml5Url, LocationHashbangUrl, LocationHtml5Url], function(Location) {
Location.prototype = Object.create(locationPrototype);

/**
* @ngdoc method
* @name $location#state
*
* @description
* This method is getter / setter.
*
* Return the history state object when called without any parameter.
*
* Change the history state object when called with one parameter and return `$location`.
* The state object is later passed to `pushState` or `replaceState`.
*
* NOTE: This method is supported only in HTML5 mode and only in browsers supporting
* the HTML5 History API (i.e. methods `pushState` and `replaceState`). If you need to support
* older browsers (like IE9 or Android < 4.0), don't use this method.
*
* @param {object=} state State object for pushState or replaceState
* @return {object} state
*/
Location.prototype.state = function(state) {
if (!arguments.length) {
return this.$$state;
}

if (Location !== LocationHtml5Url || !this.$$html5) {
throw $locationMinErr('nostate', 'History API state support is available only ' +
  'in HTML5 mode and only in browsers supporting HTML5 History API');
}
// The user might modify `stateObject` after invoking `$location.state(stateObject)`
// but we're changing the $$state reference to $browser.state() during the $digest
// so the modification window is narrow.
this.$$state = isUndefined(state) ? null : state;
this.$$urlUpdatedByLocation = true;

return this;
};
});


function locationGetter(property) {
return /** @this */ function() {
return this[property];
};
}


function locationGetterSetter(property, preprocess) {
return /** @this */ function(value) {
if (isUndefined(value)) {
return this[property];
}

this[property] = preprocess(value);
this.$$compose();

return this;
};
}


/**
* @ngdoc service
* @name $location
*
* @requires $rootElement
*
* @description
* The $location service parses the URL in the browser address bar (based on the
* [window.location](https://developer.mozilla.org/en/window.location)) and makes the URL
* available to your application. Changes to the URL in the address bar are reflected into
* $location service and changes to $location are reflected into the browser address bar.
*
* **The $location service:**
*
* - Exposes the current URL in the browser address bar, so you can
*   - Watch and observe the URL.
*   - Change the URL.
* - Synchronizes the URL with the browser when the user
*   - Changes the address bar.
*   - Clicks the back or forward button (or clicks a History link).
*   - Clicks on a link.
* - Represents the URL object as a set of methods (protocol, host, port, path, search, hash).
*
* For more information see {@link guide/$location Developer Guide: Using $location}
*/

/**
* @ngdoc provider
* @name $locationProvider
* @this
*
* @description
* Use the `$locationProvider` to configure how the application deep linking paths are stored.
*/
function $LocationProvider() {
var hashPrefix = '!',
html5Mode = {
  enabled: false,
  requireBase: true,
  rewriteLinks: true
};

/**
* @ngdoc method
* @name $locationProvider#hashPrefix
* @description
* The default value for the prefix is `'!'`.
* @param {string=} prefix Prefix for hash part (containing path and search)
* @returns {*} current value if used as getter or itself (chaining) if used as setter
*/
this.hashPrefix = function(prefix) {
if (isDefined(prefix)) {
hashPrefix = prefix;
return this;
} else {
return hashPrefix;
}
};

/**
* @ngdoc method
* @name $locationProvider#html5Mode
* @description
* @param {(boolean|Object)=} mode If boolean, sets `html5Mode.enabled` to value.
*   If object, sets `enabled`, `requireBase` and `rewriteLinks` to respective values. Supported
*   properties:
*   - **enabled** â€“ `{boolean}` â€“ (default: false) If true, will rely on `history.pushState` to
*     change urls where supported. Will fall back to hash-prefixed paths in browsers that do not
*     support `pushState`.
*   - **requireBase** - `{boolean}` - (default: `true`) When html5Mode is enabled, specifies
*     whether or not a <base> tag is required to be present. If `enabled` and `requireBase` are
*     true, and a base tag is not present, an error will be thrown when `$location` is injected.
*     See the {@link guide/$location $location guide for more information}
*   - **rewriteLinks** - `{boolean|string}` - (default: `true`) When html5Mode is enabled,
*     enables/disables URL rewriting for relative links. If set to a string, URL rewriting will
*     only happen on links with an attribute that matches the given string. For example, if set
*     to `'internal-link'`, then the URL will only be rewritten for `<a internal-link>` links.
*     Note that [attribute name normalization](guide/directive#normalization) does not apply
*     here, so `'internalLink'` will **not** match `'internal-link'`.
*
* @returns {Object} html5Mode object if used as getter or itself (chaining) if used as setter
*/
this.html5Mode = function(mode) {
if (isBoolean(mode)) {
html5Mode.enabled = mode;
return this;
} else if (isObject(mode)) {

if (isBoolean(mode.enabled)) {
  html5Mode.enabled = mode.enabled;
}

if (isBoolean(mode.requireBase)) {
  html5Mode.requireBase = mode.requireBase;
}

if (isBoolean(mode.rewriteLinks) || isString(mode.rewriteLinks)) {
  html5Mode.rewriteLinks = mode.rewriteLinks;
}

return this;
} else {
return html5Mode;
}
};

/**
* @ngdoc event
* @name $location#$locationChangeStart
* @eventType broadcast on root scope
* @description
* Broadcasted before a URL will change.
*
* This change can be prevented by calling
* `preventDefault` method of the event. See {@link ng.$rootScope.Scope#$on} for more
* details about event object. Upon successful change
* {@link ng.$location#$locationChangeSuccess $locationChangeSuccess} is fired.
*
* The `newState` and `oldState` parameters may be defined only in HTML5 mode and when
* the browser supports the HTML5 History API.
*
* @param {Object} angularEvent Synthetic event object.
* @param {string} newUrl New URL
* @param {string=} oldUrl URL that was before it was changed.
* @param {string=} newState New history state object
* @param {string=} oldState History state object that was before it was changed.
*/

/**
* @ngdoc event
* @name $location#$locationChangeSuccess
* @eventType broadcast on root scope
* @description
* Broadcasted after a URL was changed.
*
* The `newState` and `oldState` parameters may be defined only in HTML5 mode and when
* the browser supports the HTML5 History API.
*
* @param {Object} angularEvent Synthetic event object.
* @param {string} newUrl New URL
* @param {string=} oldUrl URL that was before it was changed.
* @param {string=} newState New history state object
* @param {string=} oldState History state object that was before it was changed.
*/

this.$get = ['$rootScope', '$browser', '$sniffer', '$rootElement', '$window',
function($rootScope, $browser, $sniffer, $rootElement, $window) {
var $location,
  LocationMode,
  baseHref = $browser.baseHref(), // if base[href] is undefined, it defaults to ''
  initialUrl = $browser.url(),
  appBase;

if (html5Mode.enabled) {
if (!baseHref && html5Mode.requireBase) {
  throw $locationMinErr('nobase',
    '$location in HTML5 mode requires a <base> tag to be present!');
}
appBase = serverBase(initialUrl) + (baseHref || '/');
LocationMode = $sniffer.history ? LocationHtml5Url : LocationHashbangInHtml5Url;
} else {
appBase = stripHash(initialUrl);
LocationMode = LocationHashbangUrl;
}
var appBaseNoFile = stripFile(appBase);

$location = new LocationMode(appBase, appBaseNoFile, '#' + hashPrefix);
$location.$$parseLinkUrl(initialUrl, initialUrl);

$location.$$state = $browser.state();

var IGNORE_URI_REGEXP = /^\s*(javascript|mailto):/i;

function setBrowserUrlWithFallback(url, replace, state) {
var oldUrl = $location.url();
var oldState = $location.$$state;
try {
  $browser.url(url, replace, state);

  // Make sure $location.state() returns referentially identical (not just deeply equal)
  // state object; this makes possible quick checking if the state changed in the digest
  // loop. Checking deep equality would be too expensive.
  $location.$$state = $browser.state();
} catch (e) {
  // Restore old values if pushState fails
  $location.url(oldUrl);
  $location.$$state = oldState;

  throw e;
}
}

$rootElement.on('click', function(event) {
var rewriteLinks = html5Mode.rewriteLinks;
// TODO(vojta): rewrite link when opening in new tab/window (in legacy browser)
// currently we open nice url link and redirect then

if (!rewriteLinks || event.ctrlKey || event.metaKey || event.shiftKey || event.which === 2 || event.button === 2) return;

var elm = jqLite(event.target);

// traverse the DOM up to find first A tag
while (nodeName_(elm[0]) !== 'a') {
  // ignore rewriting if no A tag (reached root element, or no parent - removed from document)
  if (elm[0] === $rootElement[0] || !(elm = elm.parent())[0]) return;
}

if (isString(rewriteLinks) && isUndefined(elm.attr(rewriteLinks))) return;

var absHref = elm.prop('href');
// get the actual href attribute - see
// http://msdn.microsoft.com/en-us/library/ie/dd347148(v=vs.85).aspx
var relHref = elm.attr('href') || elm.attr('xlink:href');

if (isObject(absHref) && absHref.toString() === '[object SVGAnimatedString]') {
  // SVGAnimatedString.animVal should be identical to SVGAnimatedString.baseVal, unless during
  // an animation.
  absHref = urlResolve(absHref.animVal).href;
}

// Ignore when url is started with javascript: or mailto:
if (IGNORE_URI_REGEXP.test(absHref)) return;

if (absHref && !elm.attr('target') && !event.isDefaultPrevented()) {
  if ($location.$$parseLinkUrl(absHref, relHref)) {
    // We do a preventDefault for all urls that are part of the AngularJS application,
    // in html5mode and also without, so that we are able to abort navigation without
    // getting double entries in the location history.
    event.preventDefault();
    // update location manually
    if ($location.absUrl() !== $browser.url()) {
      $rootScope.$apply();
      // hack to work around FF6 bug 684208 when scenario runner clicks on links
      $window.angular['ff-684208-preventDefault'] = true;
    }
  }
}
});


// rewrite hashbang url <> html5 url
if (trimEmptyHash($location.absUrl()) !== trimEmptyHash(initialUrl)) {
$browser.url($location.absUrl(), true);
}

var initializing = true;

// update $location when $browser url changes
$browser.onUrlChange(function(newUrl, newState) {

if (!startsWith(newUrl, appBaseNoFile)) {
  // If we are navigating outside of the app then force a reload
  $window.location.href = newUrl;
  return;
}

$rootScope.$evalAsync(function() {
  var oldUrl = $location.absUrl();
  var oldState = $location.$$state;
  var defaultPrevented;
  newUrl = trimEmptyHash(newUrl);
  $location.$$parse(newUrl);
  $location.$$state = newState;

  defaultPrevented = $rootScope.$broadcast('$locationChangeStart', newUrl, oldUrl,
      newState, oldState).defaultPrevented;

  // if the location was changed by a `$locationChangeStart` handler then stop
  // processing this location change
  if ($location.absUrl() !== newUrl) return;

  if (defaultPrevented) {
    $location.$$parse(oldUrl);
    $location.$$state = oldState;
    setBrowserUrlWithFallback(oldUrl, false, oldState);
  } else {
    initializing = false;
    afterLocationChange(oldUrl, oldState);
  }
});
if (!$rootScope.$$phase) $rootScope.$digest();
});

// update browser
$rootScope.$watch(function $locationWatch() {
if (initializing || $location.$$urlUpdatedByLocation) {
  $location.$$urlUpdatedByLocation = false;

  var oldUrl = trimEmptyHash($browser.url());
  var newUrl = trimEmptyHash($location.absUrl());
  var oldState = $browser.state();
  var currentReplace = $location.$$replace;
  var urlOrStateChanged = oldUrl !== newUrl ||
    ($location.$$html5 && $sniffer.history && oldState !== $location.$$state);

  if (initializing || urlOrStateChanged) {
    initializing = false;

    $rootScope.$evalAsync(function() {
      var newUrl = $location.absUrl();
      var defaultPrevented = $rootScope.$broadcast('$locationChangeStart', newUrl, oldUrl,
          $location.$$state, oldState).defaultPrevented;

      // if the location was changed by a `$locationChangeStart` handler then stop
      // processing this location change
      if ($location.absUrl() !== newUrl) return;

      if (defaultPrevented) {
        $location.$$parse(oldUrl);
        $location.$$state = oldState;
      } else {
        if (urlOrStateChanged) {
          setBrowserUrlWithFallback(newUrl, currentReplace,
                                    oldState === $location.$$state ? null : $location.$$state);
        }
        afterLocationChange(oldUrl, oldState);
      }
    });
  }
}

$location.$$replace = false;

// we don't need to return anything because $evalAsync will make the digest loop dirty when
// there is a change
});

return $location;

function afterLocationChange(oldUrl, oldState) {
$rootScope.$broadcast('$locationChangeSuccess', $location.absUrl(), oldUrl,
  $location.$$state, oldState);
}
}];
}

/**
* @ngdoc service
* @name $log
* @requires $window
*
* @description
* Simple service for logging. Default implementation safely writes the message
* into the browser's console (if present).
*
* The main purpose of this service is to simplify debugging and troubleshooting.
*
* To reveal the location of the calls to `$log` in the JavaScript console,
* you can "blackbox" the AngularJS source in your browser:
*
* [Mozilla description of blackboxing](https://developer.mozilla.org/en-US/docs/Tools/Debugger/How_to/Black_box_a_source).
* [Chrome description of blackboxing](https://developer.chrome.com/devtools/docs/blackboxing).
*
* Note: Not all browsers support blackboxing.
*
* The default is to log `debug` messages. You can use
* {@link ng.$logProvider ng.$logProvider#debugEnabled} to change this.
*
* @example
<example module="logExample" name="log-service">
<file name="script.js">
 angular.module('logExample', [])
   .controller('LogController', ['$scope', '$log', function($scope, $log) {
     $scope.$log = $log;
     $scope.message = 'Hello World!';
   }]);
</file>
<file name="index.html">
 <div ng-controller="LogController">
   <p>Reload this page with open console, enter text and hit the log button...</p>
   <label>Message:
   <input type="text" ng-model="message" /></label>
   <button ng-click="$log.log(message)">log</button>
   <button ng-click="$log.warn(message)">warn</button>
   <button ng-click="$log.info(message)">info</button>
   <button ng-click="$log.error(message)">error</button>
   <button ng-click="$log.debug(message)">debug</button>
 </div>
</file>
</example>
*/

/**
* @ngdoc provider
* @name $logProvider
* @this
*
* @description
* Use the `$logProvider` to configure how the application logs messages
*/
function $LogProvider() {
var debug = true,
self = this;

/**
* @ngdoc method
* @name $logProvider#debugEnabled
* @description
* @param {boolean=} flag enable or disable debug level messages
* @returns {*} current value if used as getter or itself (chaining) if used as setter
*/
this.debugEnabled = function(flag) {
if (isDefined(flag)) {
debug = flag;
return this;
} else {
return debug;
}
};

this.$get = ['$window', function($window) {
// Support: IE 9-11, Edge 12-14+
// IE/Edge display errors in such a way that it requires the user to click in 4 places
// to see the stack trace. There is no way to feature-detect it so there's a chance
// of the user agent sniffing to go wrong but since it's only about logging, this shouldn't
// break apps. Other browsers display errors in a sensible way and some of them map stack
// traces along source maps if available so it makes sense to let browsers display it
// as they want.
var formatStackTrace = msie || /\bEdge\//.test($window.navigator && $window.navigator.userAgent);

return {
/**
 * @ngdoc method
 * @name $log#log
 *
 * @description
 * Write a log message
 */
log: consoleLog('log'),

/**
 * @ngdoc method
 * @name $log#info
 *
 * @description
 * Write an information message
 */
info: consoleLog('info'),

/**
 * @ngdoc method
 * @name $log#warn
 *
 * @description
 * Write a warning message
 */
warn: consoleLog('warn'),

/**
 * @ngdoc method
 * @name $log#error
 *
 * @description
 * Write an error message
 */
error: consoleLog('error'),

/**
 * @ngdoc method
 * @name $log#debug
 *
 * @description
 * Write a debug message
 */
debug: (function() {
  var fn = consoleLog('debug');

  return function() {
    if (debug) {
      fn.apply(self, arguments);
    }
  };
})()
};

function formatError(arg) {
if (isError(arg)) {
  if (arg.stack && formatStackTrace) {
    arg = (arg.message && arg.stack.indexOf(arg.message) === -1)
        ? 'Error: ' + arg.message + '\n' + arg.stack
        : arg.stack;
  } else if (arg.sourceURL) {
    arg = arg.message + '\n' + arg.sourceURL + ':' + arg.line;
  }
}
return arg;
}

function consoleLog(type) {
var console = $window.console || {},
    logFn = console[type] || console.log || noop;

return function() {
  var args = [];
  forEach(arguments, function(arg) {
    args.push(formatError(arg));
  });
  // Support: IE 9 only
  // console methods don't inherit from Function.prototype in IE 9 so we can't
  // call `logFn.apply(console, args)` directly.
  return Function.prototype.apply.call(logFn, console, args);
};
}
}];
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
*     Any commits to this file should be reviewed with security in mind.  *
*   Changes to this file can potentially create security vulnerabilities. *
*          An approval from 2 Core members with history of modifying      *
*                         this file is required.                          *
*                                                                         *
*  Does the change somehow allow for arbitrary javascript to be executed? *
*    Or allows for someone to change the prototype of built-in objects?   *
*     Or gives undesired access to variables likes document or window?    *
* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

var $parseMinErr = minErr('$parse');

var objectValueOf = {}.constructor.prototype.valueOf;

// Sandboxing AngularJS Expressions
// ------------------------------
// AngularJS expressions are no longer sandboxed. So it is now even easier to access arbitrary JS code by
// various means such as obtaining a reference to native JS functions like the Function constructor.
//
// As an example, consider the following AngularJS expression:
//
//   {}.toString.constructor('alert("evil JS code")')
//
// It is important to realize that if you create an expression from a string that contains user provided
// content then it is possible that your application contains a security vulnerability to an XSS style attack.
//
// See https://docs.angularjs.org/guide/security


function getStringValue(name) {
// Property names must be strings. This means that non-string objects cannot be used
// as keys in an object. Any non-string object, including a number, is typecasted
// into a string via the toString method.
// -- MDN, https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Operators/Property_accessors#Property_names
//
// So, to ensure that we are checking the same `name` that JavaScript would use, we cast it
// to a string. It's not always possible. If `name` is an object and its `toString` method is
// 'broken' (doesn't return a string, isn't a function, etc.), an error will be thrown:
//
// TypeError: Cannot convert object to primitive value
//
// For performance reasons, we don't catch this error here and allow it to propagate up the call
// stack. Note that you'll get the same error in JavaScript if you try to access a property using
// such a 'broken' object as a key.
return name + '';
}


var OPERATORS = createMap();
forEach('+ - * / % === !== == != < > <= >= && || ! = |'.split(' '), function(operator) { OPERATORS[operator] = true; });
var ESCAPE = {'n':'\n', 'f':'\f', 'r':'\r', 't':'\t', 'v':'\v', '\'':'\'', '"':'"'};


/////////////////////////////////////////


/**
* @constructor
*/
var Lexer = function Lexer(options) {
this.options = options;
};

Lexer.prototype = {
constructor: Lexer,

lex: function(text) {
this.text = text;
this.index = 0;
this.tokens = [];

while (this.index < this.text.length) {
var ch = this.text.charAt(this.index);
if (ch === '"' || ch === '\'') {
  this.readString(ch);
} else if (this.isNumber(ch) || ch === '.' && this.isNumber(this.peek())) {
  this.readNumber();
} else if (this.isIdentifierStart(this.peekMultichar())) {
  this.readIdent();
} else if (this.is(ch, '(){}[].,;:?')) {
  this.tokens.push({index: this.index, text: ch});
  this.index++;
} else if (this.isWhitespace(ch)) {
  this.index++;
} else {
  var ch2 = ch + this.peek();
  var ch3 = ch2 + this.peek(2);
  var op1 = OPERATORS[ch];
  var op2 = OPERATORS[ch2];
  var op3 = OPERATORS[ch3];
  if (op1 || op2 || op3) {
    var token = op3 ? ch3 : (op2 ? ch2 : ch);
    this.tokens.push({index: this.index, text: token, operator: true});
    this.index += token.length;
  } else {
    this.throwError('Unexpected next character ', this.index, this.index + 1);
  }
}
}
return this.tokens;
},

is: function(ch, chars) {
return chars.indexOf(ch) !== -1;
},

peek: function(i) {
var num = i || 1;
return (this.index + num < this.text.length) ? this.text.charAt(this.index + num) : false;
},

isNumber: function(ch) {
return ('0' <= ch && ch <= '9') && typeof ch === 'string';
},

isWhitespace: function(ch) {
// IE treats non-breaking space as \u00A0
return (ch === ' ' || ch === '\r' || ch === '\t' ||
      ch === '\n' || ch === '\v' || ch === '\u00A0');
},

isIdentifierStart: function(ch) {
return this.options.isIdentifierStart ?
  this.options.isIdentifierStart(ch, this.codePointAt(ch)) :
  this.isValidIdentifierStart(ch);
},

isValidIdentifierStart: function(ch) {
return ('a' <= ch && ch <= 'z' ||
      'A' <= ch && ch <= 'Z' ||
      '_' === ch || ch === '$');
},

isIdentifierContinue: function(ch) {
return this.options.isIdentifierContinue ?
  this.options.isIdentifierContinue(ch, this.codePointAt(ch)) :
  this.isValidIdentifierContinue(ch);
},

isValidIdentifierContinue: function(ch, cp) {
return this.isValidIdentifierStart(ch, cp) || this.isNumber(ch);
},

codePointAt: function(ch) {
if (ch.length === 1) return ch.charCodeAt(0);
// eslint-disable-next-line no-bitwise
return (ch.charCodeAt(0) << 10) + ch.charCodeAt(1) - 0x35FDC00;
},

peekMultichar: function() {
var ch = this.text.charAt(this.index);
var peek = this.peek();
if (!peek) {
return ch;
}
var cp1 = ch.charCodeAt(0);
var cp2 = peek.charCodeAt(0);
if (cp1 >= 0xD800 && cp1 <= 0xDBFF && cp2 >= 0xDC00 && cp2 <= 0xDFFF) {
return ch + peek;
}
return ch;
},

isExpOperator: function(ch) {
return (ch === '-' || ch === '+' || this.isNumber(ch));
},

throwError: function(error, start, end) {
end = end || this.index;
var colStr = (isDefined(start)
      ? 's ' + start +  '-' + this.index + ' [' + this.text.substring(start, end) + ']'
      : ' ' + end);
throw $parseMinErr('lexerr', 'Lexer Error: {0} at column{1} in expression [{2}].',
  error, colStr, this.text);
},

readNumber: function() {
var number = '';
var start = this.index;
while (this.index < this.text.length) {
var ch = lowercase(this.text.charAt(this.index));
if (ch === '.' || this.isNumber(ch)) {
  number += ch;
} else {
  var peekCh = this.peek();
  if (ch === 'e' && this.isExpOperator(peekCh)) {
    number += ch;
  } else if (this.isExpOperator(ch) &&
      peekCh && this.isNumber(peekCh) &&
      number.charAt(number.length - 1) === 'e') {
    number += ch;
  } else if (this.isExpOperator(ch) &&
      (!peekCh || !this.isNumber(peekCh)) &&
      number.charAt(number.length - 1) === 'e') {
    this.throwError('Invalid exponent');
  } else {
    break;
  }
}
this.index++;
}
this.tokens.push({
index: start,
text: number,
constant: true,
value: Number(number)
});
},

readIdent: function() {
var start = this.index;
this.index += this.peekMultichar().length;
while (this.index < this.text.length) {
var ch = this.peekMultichar();
if (!this.isIdentifierContinue(ch)) {
  break;
}
this.index += ch.length;
}
this.tokens.push({
index: start,
text: this.text.slice(start, this.index),
identifier: true
});
},
