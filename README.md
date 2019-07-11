# CJSS

## A CSS based web framework

**Also, don’t use this project, especially not for anything serious. This is a joke and thought experiment. I won’t help you work through bugs.**

To install CJSS, add the [JavaScript](https://github.com/scottkellum/CJSS/blob/master/dist/cjss.min.js) to your website.

### Development

- `npm install`: Install the dependencies needed for the project
- `npm run eslint`: Check code quality
- `npm run fix`: Fix certain code issues automatically
- `npm run build`: Compile the output file
- `npm run dev`: Keep compiling the output file

Your editor probably has [a plugin](https://eslint.org/docs/user-guide/integrations) for automatically linting as you type.

The demo website can be built by leaving `npm run dev` running, and opening `demo/index.html` in your web browser.

## Using CJSS

First off, everything happens in your CSS file. You can layer this into your websites as you see fit. You can use this to layer on just a little bit more functionality in your CSS here and there or construct an entire page. It’s up to you!

### HTML

To add markup to an element, select it in your CSS file, then use `--body: html(your markup here);` to add your HTML. This markup will appear everywhere that matches your CSS selector and overwrite whatever was there before.

```css
h1 {
  --body: html(
    This is a headline
  );
}
```

If you wish to pass content through a component, use `${yield}`.

```html
<component>My Component</component>
```

```css
component {
  --html:(
    <h2>${yield}</h2>
    <p>This is a component</p>
  );
}
```

This will render as:

```html
<component>
  <h2>My Component</h2>
  <p>This is a component</p>
</component>
```

### JavaScript

You can use JavaScript to define the behavior of things right from your HTML. You want something to happen when you click on an element, but don’t want to go into your JS file? Do it right from your CSS file. If you are selecting the `script` element it will assume you are writing a global script, but everywhere else, the keyword `this` will map to the selector you are in.

```css
.item {
  cursor: pointer;
  --script: js(
    function toggle() {
      this.classList.toggle('active');
    }
    this.addEventListener('click', toggle );
  );
}
```

### Data

You can add data to your project. This is probably useful for something. Do it using the `--data` attribute. It should be formatted as JSON.

```css
nav {
  --data: json({
    "name": ["one", "two", "three"],
    "link": ["#one", "#two", "#three"]
  });
  --body: html(
    <a class="item" href="${data.link[0]}">${data.name[0]}</a>
    <a class="item" href="${data.link[1]}">${data.name[1]}</a>
    <a class="item" href="${data.link[2]}">${data.name[2]}</a>
  );
  --script: js(console.log(data));
}
```

## Reference

### Users

There are four stages to each build: `data`, `prepare`, `body` and `element`. The return value is used as the following stage’s data (if anything is returned at all), except for the body stage, when the return value is used as the new child structure of the element.

Not all stages have to be used, but only one script can exist at each level.

#### `json`

JSON: only for the data stage. The code given will be wrapped in curly braces and parsed as JSON without interpolation.

#### `html`

This can only be used for the *body* stage. The code given will be treated as a JavaScript template string, so interpolation is possible with ${}.

You have access to the variables `data` (as set in previous build steps) and `yield` (the HTML code of the contents). Note that this mode will destroy any event listeners previously bound to the children of the element.

#### `javascript`, `json`

JavaScript: for any stage. There are two modes: `js` and `js-expr`.

- `js` evaluates as a block of code, and so return values need the return keyword.
- `js-expr` evaluates as a single expression.

You always have access to the variable `data` (as set in previous build steps), and during the body stage you also have `yield` (an array of node contents). This means that events and other properties remain bound, unlike in HTML, which goes via innerHTML.

In the body stage, the return value is used to replace the contents of the element. If the return value is undefined, no changes are made, otherwise the existing contents are removed. If a string is provided, it is parsed as HTML. If a node is returned, it is added directly as the only child. If an array is returned, its elements are recursively added as nodes or text nodes.

In any other stage, the return value is assigned as `data` for the use of the future build phases. If no object is returned, the value of `data` is not updated.

### Plugin developers

To use this project, either import the root folder (`import * as CJSS from 'cjss'`), or load the minified script in your HTML. Both ways will achieve the same effect: a new object CJSS with the following methods and properties:

- `CJSS.render()`

  Render all CJSS code in all the linked CSS stylesheets.

- `CJSS.registerPlugin(modeName, plugin, ...stages)`

  Register a new mode.

  - The mode name is any valid css identifier.
  - The plugin is a function of type `(body) => (htmlElement, data) => data`, so it takes the code given to it, and returns a function taking an htmlElement target and the previous data, returning the updated data. If nothing (undefined) is returned, data is not changed.
  - The stages (e.g. `CJSS.Stage.DATA`) are used to specify which stages the plugin applies to. If this argument is omitted, this definition of a plugin will be the fallback: it will only be used when no definition specific to the current stage exists.
  
  Note that it is the responsibility of the plugin to edit the element, especially in the body stage. The function `CJSS.PluginHelpers.assignBody` (see below) should help with this.
  
  See ./plugins/{html.js, json.js, js.js} for some examples of how to use this function.

- `CJSS.Stage.{DATA, PREPARE, BODY, SCRIPT}`

  These represent the stages of a build.

- `CJSS.Error(message, originalError)`

  An error to throw when you encounter an exception while parsing or running the user’s code. The message, original error and the source location will be logged.

- `CJSS.PluginHelpers.assignBody(element, contents)`

  assigns a string, node or an array of nodes and/or text as the child(ren) of an element, which is useful for the body stage. A single string will be rendered as HTML code, whereas strings in an array will be rendered as text.
};

## Examples

[What to watch carousel by Richard Ekwonye](https://codepen.io/ekwonye/full/QXEzZv)

[Fork CJSS and play with it yourself on Codepen](https://codepen.io/scottkellum/pen/WqwjLm)
