document.addEventListener('DOMContentLoaded', function (event) {
  (function () {
    var l = document.styleSheets.length;
    for (var i = 0; i < l; ++i) {
      var sheet = document.styleSheets && document.styleSheets[i];
      if (sheet) {
        var r = sheet.rules ? sheet.rules : sheet.cssRules;
        if (r) {
          for (var j = 0; j < r.length; ++j) {
            var js = r[j].style.getPropertyValue('--js');
            var html = r[j].style.getPropertyValue('--html');
            var data = r[j].style.getPropertyValue('--data');
            var selector = r[j].style.parentRule.selectorText;
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
            if (selector === 'script') {
              eval(js.trim().slice(1, -1));
            } else {
              if (js) {
                for (n = 0; n < el.length; n++) {
                  eval(js.trim().slice(1, -1).replace(new RegExp('this', 'g'), `document.querySelectorAll('${selector}')[${n}]`));
                }
              }
            }
          }
        }
      }
    }
  })();
});
