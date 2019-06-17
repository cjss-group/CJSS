# CJSS

##### A CSS based web framework. The name means JS in CSS ;)

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

#### JavaScript

You can use JavaScript to define the behavior of things right from your HTML. You want somthing to happen on a thing when you click it and don’t want to go into your JS file? Do it right from your CSS file. If you are selecting the `script` element it will assume you are writing a global script, but everywhere else, the keyword `this` will map to the selector you are in.

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
    name: ['one', 'two', 'three'],
    link: ['#one', '#two', '#three'],
  );
  --html:(
    <a class="item" href="${data.link[0]}">${data.name[0]}</a>
    <a class="item" href="${data.link[1]}">${data.name[1]}</a>
    <a class="item" href="${data.link[2]}">${data.name[2]}</a>
  );
  --js:(console.log(data));
}
```

## [Play with CJSS on Codepen](https://codepen.io/scottkellum/pen/WqwjLm)

### Should I use CJSS in my project?

No. This is a joke I took way too far.