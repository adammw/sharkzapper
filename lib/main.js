const widgets = require("widget");
const tabs = require("tabs");
const panels = require("panel");
const pageMods = require("page-mod");
const pageWorkers = require("page-worker");
const data = require("self").data;
const SharkZapperBackground = require("./sharkzapper_background.js");

exports.main = function(options, callbacks) {
    var workers = [];
    
    var panel = panels.Panel({
	    contentURL: data.url("html/sharkzapper_popup.html"),
        width: 320,
        height: 180,
        /* TODO: this will change, it's probably best to set this from popup javascript */
    });

    var widget = widgets.Widget({
        id: "sharkzapper",
        label: "sharkZapper Lite",
        panel: panel,
        contentURL: data.url("img/icon_19.png")
    });

    var pageMod = pageMods.PageMod({
	    include: '*.grooveshark.com',
	    contentScriptWhen: 'ready',
	    contentScriptFile: data.url('js/sharkzapper_contentscript.js'),
        onAttach: function(worker) {
            worker.on('detach', function () {
              var index = workers.indexOf(worker);
              if(index != -1) {
                workers.splice(index, 1);
              }
            });
        }
    });

    var background = new SharkZapperBackground(false); // debug = false 
    
};
