const widgets = require("widget");
const tabs = require("tabs");
const panels = require("panel");
const pageMods = require("page-mod");
const data = require("self").data;

exports.main = function(options, callbacks) {
    var panel = panels.Panel({
	    contentURL: data.url("html/sharkzapper_popup.html"),
	    onMouseout: function() {
		    this.hide();
	    }
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

    /*
    var pageMod = pageMods.PageMod({
	    include: 'listen.grooveshark.com',
	    contentScriptWhen: 'ready',
	    contentScript: 'window.alert("debug:");window.alert(GS);'
    });*/
};
