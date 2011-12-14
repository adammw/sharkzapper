const widgets = require("widget");
const tabs = require("tabs");
const panels = require("panel");
const pageMods = require("page-mod");
const pageWorkers = require("page-worker");
const data = require("self").data;
const SharkZapperBackground = require("./sharkzapper_background.js");

exports.main = function(options, callbacks) {
    var workers = [];

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
