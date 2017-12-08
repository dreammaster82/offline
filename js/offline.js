(function() {
  var Offline, checkXHR, defaultOptions, extendNative, grab, handlers, init;

  extendNative = function(to, from) {
    var e, key, results, val;
    results = [];
    for (key in from.prototype) {
      try {
        val = from.prototype[key];
        if ((to[key] == null) && typeof val !== 'function') {
          results.push(to[key] = val);
        } else {
          results.push(void 0);
        }
      } catch (_error) {
        e = _error;
      }
    }
    return results;
  };

  Offline = {};

  Offline.options = window.Offline ? window.Offline.options || {} : {};

  defaultOptions = {
    checks: {
      xhr: {
        url: function() {
          return "/favicon.ico?_=" + ((new Date()).getTime());
        },
        timeout: 5000,
        type: 'HEAD'
      },
      image: {
        url: function() {
          return "/favicon.ico?_=" + ((new Date()).getTime());
        }
      },
      active: 'xhr'
    },
    checkOnLoad: false,
    interceptRequests: true,
    reconnect: true,
    deDupBody: false
  };

  grab = function(obj, key) {
    var cur, i, j, len, part, parts;
    cur = obj;
    parts = key.split('.');
    for (i = j = 0, len = parts.length; j < len; i = ++j) {
      part = parts[i];
      cur = cur[part];
      if (typeof cur !== 'object') {
        break;
      }
    }
    if (i === parts.length - 1) {
      return cur;
    } else {
      return void 0;
    }
  };

  Offline.getOption = function(key) {
    var ref, val;
    val = (ref = grab(Offline.options, key)) != null ? ref : grab(defaultOptions, key);
    if (typeof val === 'function') {
      return val();
    } else {
      return val;
    }
  };

  if (typeof window.addEventListener === "function") {
    window.addEventListener('online', function() {
      return setTimeout(Offline.confirmUp, 100);
    }, false);
  }

  if (typeof window.addEventListener === "function") {
    window.addEventListener('offline', function() {
      return Offline.confirmDown();
    }, false);
  }

  Offline.state = 'up';

  Offline.markUp = function() {
    Offline.trigger('confirmed-up');
    if (Offline.state === 'up') {
      return;
    }
    Offline.state = 'up';
    return Offline.trigger('up');
  };

  Offline.markDown = function() {
    Offline.trigger('confirmed-down');
    if (Offline.state === 'down') {
      return;
    }
    Offline.state = 'down';
    return Offline.trigger('down');
  };

  handlers = {};

  Offline.on = function(event, handler, ctx) {
    var e, events, j, len, results;
    events = event.split(' ');
    if (events.length > 1) {
      results = [];
      for (j = 0, len = events.length; j < len; j++) {
        e = events[j];
        results.push(Offline.on(e, handler, ctx));
      }
      return results;
    } else {
      if (handlers[event] == null) {
        handlers[event] = [];
      }
      return handlers[event].push([ctx, handler]);
    }
  };

  Offline.off = function(event, handler) {
    var _handler, ctx, i, ref, results;
    if (handlers[event] == null) {
      return;
    }
    if (!handler) {
      return handlers[event] = [];
    } else {
      i = 0;
      results = [];
      while (i < handlers[event].length) {
        ref = handlers[event][i], ctx = ref[0], _handler = ref[1];
        if (_handler === handler) {
          results.push(handlers[event].splice(i, 1));
        } else {
          results.push(i++);
        }
      }
      return results;
    }
  };

  Offline.trigger = function(event) {
    var ctx, handler, j, len, ref, ref1, results;
    if (handlers[event] != null) {
      ref = handlers[event].slice(0);
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        ref1 = ref[j], ctx = ref1[0], handler = ref1[1];
        results.push(handler.call(ctx));
      }
      return results;
    }
  };

  checkXHR = function(xhr, onUp, onDown) {
    return new Promise((r, rj) => {
        var _onerror, _onload, _onreadystatechange, _ontimeout, checkStatus;
        checkStatus = function() {
            if (xhr.status && xhr.status < 400) {
                onUp();
                return true;
            } else {
                onDown();
                return false;
            }
        };
        if (xhr.onprogress === null) {
            _onerror = xhr.onerror;
            xhr.onerror = function() {
                onDown();
                if (typeof _onerror === "function") _onerror.apply(null, arguments);
                rj();
            };
            _ontimeout = xhr.ontimeout;
            xhr.ontimeout = function() {
                onDown();
                if (typeof _ontimeout === "function") _ontimeout.apply(null, arguments);
                rj();
            };
            _onload = xhr.onload;
            xhr.onload = function() {
                var check = checkStatus();
                if (typeof _onload === "function") _onload.apply(null, arguments);
                check ? r() : rj();
            };
        } else {
            _onreadystatechange = xhr.onreadystatechange;
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    checkStatus() ? r() : rj();
                } else if (xhr.readyState === 0) {
                    onDown();
                    rj();
                }
                if (typeof _onreadystatechange === "function") _onreadystatechange.apply(null, arguments);
            };
        }
    });
  };

  Offline.checks = {};

  Offline.checks.xhr = function() {
    var e, xhr, promise;
    xhr = new XMLHttpRequest;
    xhr.offline = false;
    xhr.open(Offline.getOption('checks.xhr.type'), Offline.getOption('checks.xhr.url'), true);
    if (xhr.timeout != null) {
      xhr.timeout = Offline.getOption('checks.xhr.timeout');
    }
    promise = checkXHR(xhr, Offline.markUp, Offline.markDown);
    try {
      xhr.send();
    } catch (_error) {
      e = _error;
      Offline.markDown();
    }
    return promise;
  };

  Offline.checks.image = function() {
    return new Promise((r, rj) => {
        var img;
        img = document.createElement('img');
        img.onerror = () => {
          Offline.markDown();
          rj();
        };
        img.onload = () => {
          Offline.markUp();
          r();
        };
        img.src = Offline.getOption('checks.image.url');
    });
  };

  Offline.checks.down = Offline.markDown;

  Offline.checks.up = Offline.markUp;

  Offline.check = function() {
    Offline.trigger('checking');
    return Offline.checks[Offline.getOption('checks.active')]();
  };

  Offline.confirmUp = Offline.confirmDown = Offline.check;

  Offline.onXHR = function(cb) {
    var _XDomainRequest, _XMLHttpRequest, monitorXHR;
    monitorXHR = function(req, flags) {
      var _open;
      _open = req.open;
      return req.open = function(type, url, async, user, password) {
        cb({
          type: type,
          url: url,
          async: async,
          flags: flags,
          user: user,
          password: password,
          xhr: req
        });
        return _open.apply(req, arguments);
      };
    };
    _XMLHttpRequest = window.XMLHttpRequest;
    window.XMLHttpRequest = function(flags) {
      var _overrideMimeType, _setRequestHeader, req;
      req = new _XMLHttpRequest(flags);
      monitorXHR(req, flags);
      _setRequestHeader = req.setRequestHeader;
      req.headers = {};
      req.setRequestHeader = function(name, value) {
        req.headers[name] = value;
        return _setRequestHeader.call(req, name, value);
      };
      _overrideMimeType = req.overrideMimeType;
      req.overrideMimeType = function(type) {
        req.mimeType = type;
        return _overrideMimeType.call(req, type);
      };
      return req;
    };
    extendNative(window.XMLHttpRequest, _XMLHttpRequest);
    if (window.XDomainRequest != null) {
      _XDomainRequest = window.XDomainRequest;
      window.XDomainRequest = function() {
        var req;
        req = new _XDomainRequest;
        monitorXHR(req);
        return req;
      };
      return extendNative(window.XDomainRequest, _XDomainRequest);
    }
  };

  init = function() {
    if (Offline.getOption('interceptRequests')) {
      Offline.onXHR(function(arg) {
        var xhr;
        xhr = arg.xhr;
        if (xhr.offline !== false) {
          return checkXHR(xhr, Offline.markUp, Offline.confirmDown);
        }
      });
    }
    if (Offline.getOption('checkOnLoad')) {
      return Offline.check();
    }
  };

  setTimeout(init, 0);

  window.Offline = Offline;

}).call(this);
