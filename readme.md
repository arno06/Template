Template
===
JS Template engine

Features
---
* Variables (String, Number, Array, Object)
* Loops
* Conditions
* Functions
* Event based
* Smarty'ish syntax
* ES6 Compliant
* Template inclusion

Dependencies
---
* [Request](http://github.com/arno06/Request) : Async template loading

Example
---
Html template definition :

```html
<!DOCTYPE html>
<html>
	<head>
		<title>Template.js - Sample</title>
		<script src="Template.js"></script>
	</head>
	<body>
		<h1>Template.js - Sample</h1>
		<div id="holder"></div>
        <script type="text/template" id="includeTpl">
            <div>This is an include</div>
            <div>{$var}</div>
            <div>{$var1}</div>
        </script>
        <script type="text/template" id="firstTemplate">
            <h2>Hello {$var1}</h2>
            <ul>
                {foreach from=$myTable}
                <li>{$item} : {if $key%2==0} even {else} odd {/if}</li>
                {else}
                <li>Empty Table</li>
                {/foreach}
            </ul>
            <p>Hi, I am {$me.name} and I am in a {$me.mood} mood.</p>
            <p>fooFunc : {fooFunc named_var="value"}</p>
            {include id="includeTpl" var="hello" var1=$var1}
        </script>
	</body>
</html>
```
Javascript part (js/Sample.js) :

```js
function init()
{
    var fooFunc = function(named_var){return "bar "+named_var;};
    var table = ["This", "must", "work"];
    var me = {"name":"Template.js", "mood":"pretty good"};
    var tpl = new Template("firstTemplate");
    tpl.assign("var1", "world");
    tpl.assign("me", me);
    tpl.assign("myTable", table);
    tpl.setFunction("fooFunc", fooFunc);
    tpl.addEventListener(TemplateEvent.RENDER_INIT, tplRenderInitHandler, false);
    tpl.addEventListener(TemplateEvent.RENDER_COMPLETE, tplRenderCompleteHandler, false);
    tpl.addEventListener(TemplateEvent.RENDER_COMPLETE_LOADED, tplRenderCompleteLoadedHandler, false);
    tpl.render("#holder");
}
window.addEventListener("load", init, false);

function tplRenderInitHandler(e)
{
    console.log("Sample.js : init");
}

function tplRenderCompleteHandler(e)
{
    //Ready to display result
    console.log("Sample.js : complete");
}

function tplRenderCompleteLoadedHandler(e)
{
    //Ready to display & everything is loaded (images)
    console.log("Sample.js : complete & loaded");
}
```

API Reference
---
### Template

#### Template(pIdTemplate, pData)
Constructor - Instanciate a Template Object

* pIdTemplate (*string*) : Script template's id within DOM
* pData (*object*) : Default assigned data

#### assign(pName, pValue)
Variable asignation method

* pName (*string*) : Variable's name
* pValue (*misc*) : Variable's value, could be a String, a Number, an Object or an Array

#### evaluate()
Evaluate template & return the result (as string)

#### render(pParentNode)
Evaluate & render template

* pParentNode (*string*|*HTMLElement*) : Specifies a HTMLElement to be the parentNode of template's evaluation result

#### setFunction(pName, pFunction)
Function definition method

* pName (*string*) : Function's name
* pFunction (*function*) : function to execute each time template refer to it
```js
tpl.setFunction("round", function(value)
{
	return Math.round(value);
});
```

#### addEventListener(pType, pHandler, pCapture)
(inherited) 

#### dispatchEvent(pEvent)
(inherited) 

#### removeAllEventListener(pType)
(inherited) 

#### removeEventListener(pType, pHandler, pCapture)
(inherited) 

#### toString()
(inherited) 

### TemplateEvent

#### RENDER_INIT
Event triggered once rendering initialized

#### RENDER_COMPLETE
Event sent when the rendering phase is completed

#### RENDER_COMPLETE_LOADED
Event sent when the rendering phase is completed and once every images are loaded
