(function() {

  let global_file_finger = null;
  let input_timeout = null;

  // 获取目录结构
  function getDirectory() {
    return $.ajax({
      url: 'http://localhost:' + __PORT__ + '/ui/directory',
      method: 'GET'
    })
  }

  // 获取文件内容
  function getFile(path, isUpdate) {
    return $.ajax({
      url: 'http://localhost:' + __PORT__ + '/ui/file',
      method: 'GET',
      data: {
        path: path,
        update: isUpdate
      },
      error: res => {
        console.log('after getFile')
        console.log(res)
      }
    })
  }

  // 更新文件内容
  function postChange(path, value) {
    return $.ajax({
      url: 'http://localhost:' + __PORT__ + '/ui/file',
      method: 'POST',
      data: {
        path: path,
        value: value
      }
    })
  }

  // 获取API结果
  function getResult(url, method, params, headers) {
    return $.ajax({
      url: 'http://localhost:' + __PORT__ + url,
      method: method,
      headers: headers,
      data: params
    })
  }

  Vue.component("tree-item", {
    template: "#item-template",
    props: {
      item: Object,
      path: String
    },
    watch: {
      path(value) {
      }
    },
    data() {
      return {
        isOpen: false
      };
    },
    computed: {
      isFolder() {
        return this.item.children && this.item.children.length;
      }
    },
    mounted() {
    },
    methods: {
      toggle() {
        if (this.isFolder) {
          this.isOpen = !this.isOpen;
        } else {
          const path = this.item.path
          if (path) {
            console.log(path);
            getFile(path).done(res => {
              console.log(res);
              global_file_finger = res.finger;
              // 初始化代码
              res.initialCode = true;
              if (res.content) {
                this.$emit("update-code", res);
                this.$emit("update-current-path", path);
              }
            })
          }
        }
      },
      makeFolder() {
        if (!this.isFolder) {
          this.$emit("make-folder", this.item);
          this.isOpen = true;
        }
      }
    }
  });

  Vue.use(window.VueCodemirror);

  var demo = new Vue({
    el: "#lm_container",
    vuetify: new Vuetify(),
    data: {
      treeData: null,
      code: "function myScript(){return 100;}",
      apiMap: {},
      jsonCode: '',
      currentPath: '',
      loadingResult: false,
      cmOption: {
        mode:  "javascript",
        lineNumbers: true,
        theme: "dracula",
        matchBrackets: true, // 括号高亮
        tabSize: 2,
        autofocus: true,
        indentWithTabs: true,
        smartIndent: true, // 自动缩进
        styleActiveLine: true, // 当前行高亮
        scrollbarStyle: "simple",
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "CodeMirror-lint-markers"],
        lint: true,
        foldOptions: {
          widget: this.foldWidget
        },
        // extraKeys: {
        //  "Cmd-S": (instance) => { 
        //    console.log('save file');
        //    this.postChange()
        //  }
        // }
        // extraKeys: {"'@'": "autocomplete"} // 自动填充关键字
      },
      cmResultOption: {
        readOnly: true,
        mode: {name: "javascript", json: true},
        lineNumbers: true,
        lineWrapping: true,
        extraKeys: {"Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); }},
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        foldOptions: {
          widget: this.foldWidget
        }
      }
    },
    computed: {
      cm() {
        return this.$refs.cm.codemirror;
      },
      res_cm() {
        return this.$refs.res_cm.codemirror;
      }
    },
    created() {
      getDirectory().done(res => {
        this.treeData = res.dir || {};
      })
    },
    mounted() {
      this.cm.setSize("100%", "100%")
      this.res_cm.setSize("100%", "100%")
      this.cm.addKeyMap({
        name: 'autoInsertParentheses',
        "'{'": cm => {
          const cur = cm.getCursor();

          cm.replaceRange('{}', cur, cur, '+insert');
          cm.doc.setCursor({
            line: cur.line,
            ch: cur.ch + 1
          })
        }
      })
      // show hint
      this.cm.setOption('extraKeys', {
        "'@'": () => {
          this.snippet();
        }
      })
      if (this.jsonCode) {
        this.res_cm.foldCode(CodeMirror.Pos(5, 0));
      }
      this.initCommands();
      this.initResize();
    },
    methods: {
      initCommands() {
        document.onkeydown = e => {
          var currKey = 0, e = e || event || window.event;
          currKey = e.keyCode || e.which || e.charCode;
          if(currKey == 83 && (e.ctrlKey || e.metaKey)){
            e.preventDefault();
            console.log('save file')
            this.postChange();
            return false;
          }
        }
      },
      initResize() {
        const folder = document.getElementById("lm_editor_folder");
        const resize1 = document.getElementById("lm_editor_resize1");
        const resize2 = document.getElementById("lm_editor_resize2");
        const left = document.getElementById("lm_editor");
        const right = document.getElementById("lm_editor_result");
        const box = document.getElementById("lm_container");
        resize1.onmousedown = function(e) {
          const resizeWidth = resize1.offsetWidth;
          const foldWidth = folder.offsetWidth;
          const boxWidth = folder.offsetWidth + left.offsetWidth + resizeWidth;
          const startX = e.clientX;
          resize1.left = resize1.offsetLeft;
          document.onmousemove = function(e){
            var endX = e.clientX;
            var moveLen = resize1.left + (endX - startX);
            var maxT = boxWidth - resizeWidth;
            if(moveLen < 0) moveLen = 0;
            if(moveLen > maxT - 300) moveLen = maxT - 300;
      
            resize1.style.left = moveLen;
            folder.style.width = moveLen + "px";
            left.style.width = (boxWidth - moveLen - 4) + "px";
          }
          document.onmouseup = function(evt){
            document.onmousemove = null;
            document.onmouseup = null; 
            resize1.releaseCapture && resize1.releaseCapture();
          }
          resize1.setCapture && resize1.setCapture();
          return false;
        }
        resize2.onmousedown = function(e) {
          const resizeWidth = resize2.offsetWidth;
          const foldWidth = folder.offsetWidth;
          const boxWidth = box.clientWidth - foldWidth;
          const startX = e.clientX;
          resize2.left = resize2.offsetLeft;
          document.onmousemove = function(e){
            var endX = e.clientX;
            var moveLen = resize2.left - foldWidth + (endX - startX);
            var maxT = boxWidth - resizeWidth;
            if(moveLen < 300) moveLen = 300; 
            if(moveLen > maxT - 300) moveLen = maxT - 300;
      
            resize2.style.left = moveLen;
            left.style.width = moveLen + "px";
            right.style.width = (boxWidth - moveLen - 4) + "px";
          }
          document.onmouseup = function(evt){
            document.onmousemove = null;
            document.onmouseup = null; 
            resize2.releaseCapture && resize2.releaseCapture();
          }
          resize2.setCapture && resize2.setCapture();
          return false;
        }
      },
      snippet() {
        CodeMirror.showHint(this.cm, () => {
          const cursor = this.cm.getCursor()
          const token = this.cm.getTokenAt(cursor)
          const start = token.start
          const end = cursor.ch
          const line = cursor.line
          const currentWord = token.string
    
          const list = global_snippets.filter((item) => {
            return item.text.indexOf(currentWord) >= 0
          })
    
          return {
            list: list.length ? list : global_snippets,
            from: CodeMirror.Pos(line, start),
            to: CodeMirror.Pos(line, end)
          }
        }, { completeSingle: false })
      },
      onCmBlur() {
      },
      onCmFocus() {
      },
      onCmReady() {},
      onChange(instance, changes) {
        console.log(changes);
        // 区分是选中文件还是修改文件
        // if (this.initialCode) {
        //   this.initialCode = false;
        //   return;
        // }
        // clearTimeout(input_timeout);
        // input_timeout = setTimeout(() => {
        //   this.postChange()
        // }, 500)
      },
      postChange() {
        console.log('post Change');
        this.loadingResult = true;
        this.jsonCode = '';
        const value = this.cm.getValue();
        postChange(this.currentPath, value).done(res => {
          if (res.status === 200) {
            this.loopToUpdateResult();
          }
        });
      },
      loopToUpdateResult() {
        getFile(this.currentPath, true).done(res => {
          if (res.finger !== global_file_finger) {
            this.loadingResult = false;
            global_file_finger = res.finger;
            if (res.content) {
              this.updateCode(res);
            } else {
              this.jsonCode = '格式错误';
            }
          } else {
            const to = setTimeout(() => {
              clearTimeout(to);
              this.loopToUpdateResult()
            }, 1000);
          }
        })
      },
      makeFolder(item) {
        alert('male')
        Vue.set(item, "children", []);
        this.addItem(item);
      },
      addItem(item) {
        item.children.push({
          name: "new stuff"
        });
      },
      updateCode(res) {
        this.initialCode = res.initialCode;
        this.code = res.content;
        this.apiMap = res.api;
        if (this.apiMap.status === 500) {
          this.jsonCode = this.apiMap.msg
        } else {
          getResult(this.apiMap.url, this.apiMap.method).done(res => {
            this.jsonCode = JSON.stringify(res, null, "\t");
          });
        }
      },
      updateCurrentPath(path) {
        this.currentPath = path;
      },
      foldWidget(from, to) {
        var count = undefined;

        // Get open / close token
        var startToken = '{', endToken = '}';        
        var prevLine = this.res_cm.getLine(from.line);
        if (prevLine.lastIndexOf('[') > prevLine.lastIndexOf('{')) {
          startToken = '[', endToken = ']';
        }

        // Get json content
        var internal = this.res_cm.getRange(from, to);
        var toParse = startToken + internal + endToken;

        // Get key count
        try {
          var parsed = JSON.parse(toParse);
          count = Object.keys(parsed).length;
        } catch(e) { }        

        return count ? `\u21A4${count}\u21A6` : '\u2194';
      }
    }
  });
})()