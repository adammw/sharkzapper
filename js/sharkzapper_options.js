var sharkzapper = new (function SharkZapperOptions(debug) {
    var sharkzapper = this;
    sharkzapper.cachedSettings = {};
    sharkzapper.actions = {
        loadSettings: function loadSettings(settings) {
            for(i in settings) {
                var box = document.getElementById('settings_sharkzapper_'+i);
                if (!box) continue;
                box.checked = settings[i];
            }
        },
        saveSettings: function saveSettings() {
            var inputs = document.querySelectorAll('input');
            var settings = sharkzapper.cachedSettings;
            for (var i=0;i<inputs.length;i++) {
                console.log(i, inputs[i], inputs[i].id);
                if (inputs[i].id.indexOf('settings_sharkzapper_') == 0) {
                    settings[inputs[i].id.replace('settings_sharkzapper_','')] = Boolean(inputs[i].checked);
                }
            }
            sharkzapper.message.send({"command":"settingsUpdate", "settings": settings});
            document.querySelector('.status').classList.add('success');
        }
    };
    
    sharkzapper.listeners = {
        bind: function bind_listners() {  
            // DOM Events
            document.addEventListener('DOMContentLoaded', function() {
                document.getElementById('settings_sharkzapper').addEventListener('submit', sharkzapper.listeners.submit);
                document.querySelector('button.saveChanges').addEventListener('click', sharkzapper.listeners.saveClick);
                (function(inputs, fn) {
                    for(var i=0;i<inputs.length;i++) {
                        inputs[i].addEventListener('change', fn);
                    }
                })(document.querySelectorAll('input'), sharkzapper.listeners.change);
            });
                             
            // Chrome Events
            chrome.extension.onRequest.addListener(sharkzapper.listeners.request);
        },
        unbind: function unbind_listeners() {
            // DOM Events
            document.getElementById('settings_sharkzapper').removeEventListener('submit', sharkzapper.listeners.submit);
            document.querySelector('button.saveChanges').removeEventListener('click', sharkzapper.listeners.saveClick);
            (function(inputs, fn) {
                for(var i=0;i<inputs.length;i++) {
                    inputs[i].removeEventListener('change', fn);
                }
            })(document.querySelectorAll('input'), sharkzapper.listeners.change);
            
            // Chrome Events
            chrome.extension.onRequest.removeListener(sharkzapper.listeners.request);
        },
        request: function handle_request(request, sender, sendResponse) {
            //TODO: filter
            sharkzapper.message.recieve(request);
        },
        submit: function handle_submit(e) {
            e.preventDefault();
            sharkzapper.actions.saveSettings();
        },
        saveClick: function handle_saveClick(e) {
            e.preventDefault();
            sharkzapper.actions.saveSettings();
        },
        change: function handle_change() {
            document.querySelector('.status').classList.remove('success');
        }
    };
    
    sharkzapper.message = {
        send: function message_send(data) {
            data.source = "options";
            if (debug) data.timestamp = (new Date()).valueOf();
            if (debug) console.log("sharkzapper:", ">>>", data.command, data);
        	chrome.extension.sendRequest(data);
        }, 
        recieve: function message_recieve(data) {
            if (debug && data.command != 'statusUpdate') console.log("sharkzapper:", "<<<", data.command, data);
            switch (data.command) {
                case 'settingsUpdate': 
                    sharkzapper.cachedSettings = data.settings;
                    sharkzapper.actions.loadSettings(data.settings);
                    break;
            }
        }
    };
    
    sharkzapper.init = function init() {
        sharkzapper.listeners.bind();

        sharkzapper.message.send({"command": "fetchSettings"});
        
        return sharkzapper;
    };
    
    return sharkzapper.init();
})(true);
