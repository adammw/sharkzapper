const widgets = require("widget");
const tabs = require("tabs");
const panels = require("panel");
const pageMods = require("page-mod");
const data = require("self").data;

exports.main = function(options, callbacks) {
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
        contentURL: data.url("img/icon_19.png"),
        onClick: function() {
            tabs.open("http://grooveshark.com/");
        },
        onMouseover: function() {
            this.panel.show();
        }
    });

    var pageMod = pageMods.PageMod({
	    include: '*.grooveshark.com',
	    contentScriptWhen: 'ready',
	    contentScriptFile: data.url('js/sharkzapper_contentscript.js'),
    });
};
