(function (document, window) {
  'use strict';

  var inlineAttachment = function (options, instance) {
    this.settings = inlineAttachment.util.merge(options, inlineAttachment.defaults);
    this.editor = instance;
    this.filenameTag = '{filename}';
    this.lastValue = null;
  };

  inlineAttachment.editors = {};

  inlineAttachment.util = {
    merge: function () {
      var result = {};
      for (var i = arguments.length - 1; i >= 0; i--) {
        var obj = arguments[i];
        for (var k in obj) {
          if (obj.hasOwnProperty(k)) {
            result[k] = obj[k];
          }
        }
      }
      return result;
    },

    appendInItsOwnLine: function (previous, appended) {
      return (previous + '\n\n[[D]]' + appended).replace(/(\n{2,})\[\[D\]\]/, '\n\n').replace(/^(\n*)/, '');
    },

    insertTextAtCursor: function (el, text) {
      var scrollPos = el.scrollTop,
        strPos = 0,
        browser = false,
        range;

      if (el.selectionStart || el.selectionStart === '0') {
        browser = 'ff';
      } else if (document.selection) {
        browser = 'ie';
      }

      if (browser === 'ie') {
        el.focus();
        range = document.selection.createRange();
        range.moveStart('character', -el.value.length);
        strPos = range.text.length;
      } else if (browser === 'ff') {
        strPos = el.selectionStart;
      }

      var front = el.value.substring(0, strPos);
      var back = el.value.substring(strPos, el.value.length);
      el.value = front + text + back;
      strPos = strPos + text.length;
      if (browser === 'ie') {
        el.focus();
        range = document.selection.createRange();
        range.moveStart('character', -el.value.length);
        range.moveStart('character', strPos);
        range.moveEnd('character', 0);
        range.select();
      } else if (browser === 'ff') {
        el.selectionStart = strPos;
        el.selectionEnd = strPos;
        el.focus();
      }
      el.scrollTop = scrollPos;
    },
  };

  inlineAttachment.defaults = {
    uploadUrl: '/upload',

    uploadMethod: 'POST',

    uploadFieldName: 'file',

    defaultExtension: 'png',

    jsonFieldName: 'filename',

    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'],

    progressText: '![Uploading file...]()',

    urlText: '![file]({filename})',

    fileUrlText: '[file]({filename})',

    errorText: 'Error uploading file',

    extraParams: {},

    extraHeaders: {},

    beforeFileUpload: function () {
      return true;
    },

    onFileReceived: function (e) {
      console.log(e);
    },

    onFileUploadResponse: function () {
      return true;
    },

    onFileUploadError: function () {
      return true;
    },

    onFileUploaded: function (e) {
      console.log(e);
    },
  };

  inlineAttachment.prototype.uploadFile = function (file) {
    var me = this,
      formData = new FormData(),
      xhr = new XMLHttpRequest(),
      settings = this.settings,
      extension = settings.defaultExtension || settings.defualtExtension;

    if (typeof settings.setupFormData === 'function') {
      settings.setupFormData(formData, file);
    }

    // Attach the file. If coming from clipboard, add a default filename (only works in Chrome for now)
    // http://stackoverflow.com/questions/6664967/how-to-give-a-blob-uploaded-as-formdata-a-file-name
    if (file.name) {
      var fileNameMatches = file.name.match(/\.(.+)$/);
      if (fileNameMatches) {
        extension = fileNameMatches[1];
      }
    }

    var remoteFilename = 'image-' + Date.now() + '.' + extension;
    if (typeof settings.remoteFilename === 'function') {
      remoteFilename = settings.remoteFilename(file);
    }

    formData.append(settings.uploadFieldName, file, remoteFilename);

    // Append the extra parameters to the formdata
    if (typeof settings.extraParams === 'object') {
      for (var key in settings.extraParams) {
        if (settings.extraParams.hasOwnProperty(key)) {
          formData.append(key, settings.extraParams[key]);
        }
      }
    }

    xhr.open('POST', settings.uploadUrl);

    // Add any available extra headers
    if (typeof settings.extraHeaders === 'object') {
      for (var header in settings.extraHeaders) {
        if (settings.extraHeaders.hasOwnProperty(header)) {
          xhr.setRequestHeader(header, settings.extraHeaders[header]);
        }
      }
    }

    xhr.onload = function () {
      // If HTTP status is OK or Created
      if (xhr.status === 200 || xhr.status === 201) {
        me.onFileUploadResponse(xhr);
      } else {
        me.onFileUploadError(xhr);
      }
    };
    if (settings.beforeFileUpload(xhr) !== false) {
      xhr.send(formData);
    }
    return xhr;
  };

  inlineAttachment.prototype.isFileAllowed = function (file) {
    if (file.kind === 'string') {
      return false;
    }
    return true;
    // if (this.settings.allowedTypes.indexOf("*") === 0) {
    //   return true;
    // } else {
    //   return this.settings.allowedTypes.indexOf(file.type) >= 0;
    // }
  };

  inlineAttachment.prototype.onFileUploadResponse = function (xhr) {
    if (this.settings.onFileUploadResponse.call(this, xhr) !== false) {
      var result = JSON.parse(xhr.responseText),
        filename = result[this.settings.jsonFieldName];
      if (result && filename) {
        var newValue;
        if (typeof this.settings.urlText === 'function') {
          newValue = this.settings.urlText.call(this, filename, result);
        } else {
          newValue = this.settings.urlText.replace(this.filenameTag, filename).replace('[file]', '[' + result.name + ']');

          if (!['jpeg', 'jpg', 'png', 'gif'].includes(result.extension)) {
            newValue = newValue.replace('!', '');
          }
        }

        var text = this.editor.getValue().replace(this.lastValue, newValue);
        this.editor.setValue(text);
        this.settings.onFileUploaded.call(this, filename);
      }
    }
  };

  inlineAttachment.prototype.onFileUploadError = function (xhr) {
    if (this.settings.onFileUploadError.call(this, xhr) !== false) {
      var text = this.editor.getValue().replace(this.lastValue, this.settings.errorText);
      this.editor.setValue(text);
    }
  };

  inlineAttachment.prototype.onFileInserted = function (file) {
    if (this.settings.onFileReceived.call(this, file) !== false) {
      this.lastValue = this.settings.progressText;
      this.editor.insertValue(this.lastValue);
    }
  };

  inlineAttachment.prototype.onPaste = function (e) {
    var result = false,
      clipboardData = e.clipboardData,
      items;

    if (typeof clipboardData === 'object') {
      items = clipboardData.items || clipboardData.files || [];

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (this.isFileAllowed(item)) {
          result = true;
          this.onFileInserted(item.getAsFile());
          this.uploadFile(item.getAsFile());
        }
      }
    }

    if (result) {
      e.preventDefault();
    }

    return result;
  };

  inlineAttachment.prototype.onDrop = function (e) {
    var result = false;
    for (var i = 0; i < e.dataTransfer.files.length; i++) {
      var file = e.dataTransfer.files[i];
      if (this.isFileAllowed(file)) {
        result = true;
        this.onFileInserted(file);
        this.uploadFile(file);
      }
    }

    return result;
  };

  window.inlineAttachment = inlineAttachment;
})(document, window);

(function () {
  'use strict';

  var codeMirrorEditor = function (instance) {
    if (!instance.getWrapperElement) {
      throw 'Invalid CodeMirror object given';
    }

    this.codeMirror = instance;
  };

  codeMirrorEditor.prototype.getValue = function () {
    return this.codeMirror.getValue();
  };

  codeMirrorEditor.prototype.insertValue = function (val) {
    this.codeMirror.replaceSelection(val);
  };

  codeMirrorEditor.prototype.setValue = function (val) {
    var cursor = this.codeMirror.getCursor();
    this.codeMirror.setValue(val);
    this.codeMirror.setCursor(cursor);
  };

  codeMirrorEditor.attach = function (codeMirror, options) {
    options = options || {};

    var editor = new codeMirrorEditor(codeMirror),
      inlineattach = new inlineAttachment(options, editor),
      el = codeMirror.getWrapperElement();

    el.addEventListener(
      'paste',
      function (e) {
        inlineattach.onPaste(e);
      },
      false
    );

    codeMirror.setOption('onDragEvent', function (data, e) {
      if (e.type === 'drop') {
        e.stopPropagation();
        e.preventDefault();
        return inlineattach.onDrop(e);
      }
    });
  };

  var codeMirrorEditor4 = function (instance) {
    codeMirrorEditor.call(this, instance);
  };

  codeMirrorEditor4.attach = function (codeMirror, options) {
    options = options || {};

    var editor = new codeMirrorEditor(codeMirror),
      inlineattach = new inlineAttachment(options, editor),
      el = codeMirror.getWrapperElement();

    el.addEventListener(
      'paste',
      function (e) {
        inlineattach.onPaste(e);
      },
      false
    );

    codeMirror.on('drop', function (data, e) {
      if (inlineattach.onDrop(e)) {
        e.stopPropagation();
        e.preventDefault();
        return true;
      } else {
        return false;
      }
    });
  };

  inlineAttachment.editors.codemirror = codeMirrorEditor4;
})();

(function () {
  'use strict';

  inlineAttachment.editors.input = {
    Editor: function (instance) {
      var input = instance;

      return {
        getValue: function () {
          return input.value;
        },
        insertValue: function (val) {
          inlineAttachment.util.insertTextAtCursor(input, val);
        },
        setValue: function (val) {
          input.value = val;
        },
      };
    },
    attachToInput: function (input, options) {
      options = options || {};

      var editor = new inlineAttachment.editors.input.Editor(input),
        inlineattach = new inlineAttachment(options, editor);

      input.addEventListener(
        'paste',
        function (e) {
          inlineattach.onPaste(e);
        },
        false
      );
      input.addEventListener(
        'drop',
        function (e) {
          e.stopPropagation();
          e.preventDefault();
          inlineattach.onDrop(e);
        },
        false
      );
      input.addEventListener(
        'dragenter',
        function (e) {
          e.stopPropagation();
          e.preventDefault();
        },
        false
      );
      input.addEventListener(
        'dragover',
        function (e) {
          e.stopPropagation();
          e.preventDefault();
        },
        false
      );
    },
  };
})();
