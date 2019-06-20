# CJSS

## A CSS based web framework

##### Also, don’t use this project, especially not for anything serious. This is a joke and thought experiment. I won’t help you work through bugs.

To install CJSS, add the [JavaScript](https://github.com/scottkellum/CJSS/blob/master/cjss.js) to your website.

### Using CJSS

First off, everything happens in your CSS file. You can layer this into your websites as you see fit. You can use this to layer on just a little bit more functionality in your CSS here and there or construct an entire page. It’s up to you!

#### HTML

To add markup to an element, select it in your CSS file, then using `--html:(your markup here);` add your HTML. This markup will appear everywhere that matches your CSS selector and overwrite whatever was there before.

```css
h1 {
  --html:(
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

#### JavaScript

You can use JavaScript to define the behavior of things right from your HTML. You want something to happen on a thing when you click it and don’t want to go into your JS file? Do it right from your CSS file. If you are selecting the `script` element it will assume you are writing a global script, but everywhere else, the keyword `this` will map to the selector you are in.

```css
.item {
  cursor: pointer;
  --js:(
    function toggle() {
      this.classList.toggle('active');
    }
    this.addEventListener('click', toggle );
  );
}
```

#### Data

You can add data to your project. Probably useful for something. Do it using the `--data` attribute. It should be formatted as JSON.

```css
nav {
  --data:(
    name: ["one", "two", "three"],
    link: ["#one", "#two", "#three"],
  );
  --html:(
    <a class="item" href="${data.link[0]}">${data.name[0]}</a>
    <a class="item" href="${data.link[1]}">${data.name[1]}</a>
    <a class="item" href="${data.link[2]}">${data.name[2]}</a>
  );
  --js:(console.log(data));
}
```

# Examples

[What to watch carousel by Richard Ekwonye](https://codepen.io/ekwonye/full/QXEzZv)

[Fork CJSS and play with it yourself on Codepen](https://codepen.io/scottkellum/pen/WqwjLm)
