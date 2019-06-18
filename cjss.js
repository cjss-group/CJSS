document.addEventListener('DOMContentLoaded', function (event) {
  function cjss(s) {
    for (var i = 0; i < s.length; ++i) {
      if (s[i].constructor.name === 'CSSImportRule') {
        try {
          var n = s[i].styleSheet.cssRules;
          if (n) cjss(n);
        } catch (e) {
          if (e.name !== "SecurityError") throw e;
        }
      } else if (s[i].constructor.name === 'CSSStyleRule') {
        var js = s[i].style.getPropertyValue('--js');
        var html = s[i].style.getPropertyValue('--html');
        var data = s[i].style.getPropertyValue('--data');
        var selector = s[i].style.parentRule.selectorText;
        var el = document.querySelectorAll(selector);
        if (data) {
          eval(`data = { ${data.trim().slice(1, -1)} }`);
        }
        if (html) {
          el.forEach(function (e) {
            const yield = e.innerHTML;
            e.innerHTML = eval('`' + html.trim().slice(1, -1) + '`');
          });
        }
        if (js) {
          if (selector === 'script') {
            eval(js.trim().slice(1, -1));
          } else {
            for (n = 0; n < el.length; n++) {
              eval(js.trim().slice(1, -1).replace(new RegExp('this', 'g'), `document.querySelectorAll('${selector}')[${n}]`));
            }
          }
        }
      }
    }
  }
  var l = document.styleSheets.length;
  for (var i = 0; i < l; ++i) {
    var sheet = document.styleSheets && document.styleSheets[i];
    if (sheet) {
      var r = sheet.rules ? sheet.rules : sheet.cssRules;
      if (r) {
        cjss(r);
      }
    }
  }
});
