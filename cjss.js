document.addEventListener('DOMContentLoaded', function (event) {
  (function () {
    var ev = code => (Function(code))();
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
              ev(`data = { ${data.trim().slice(1, -1)} }`);
            }
            if (html) {
              el.forEach(function (e) {
                const yield = e.innerHTML;
                e.innerHTML = ev('`' + html.trim().slice(1, -1) + '`');
              });
            }
            if (selector === 'script') {
              ev(js.trim().slice(1, -1));
            } else {
              if (js) {
                for (n = 0; n < el.length; n++) {
                  ev(js.trim().slice(1, -1).replace(new RegExp('this', 'g'), `document.querySelectorAll('${selector}')[${n}]`));
                }
              }
            }
          }
        }
      }
    }
  })();
});
