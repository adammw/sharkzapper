/*
 * sharkzapper_contentscript.js
 * This is the content script for sharkZapper which works on Grooveshark's website to inject our listener
 *
 * sharkZapper is Copyright (C) 2010-2011 Adam Malcontenti-Wilson <adman.com@gmail.com>
 * You are hereby granted a licence to use the software as-is, and view the source code for educational purposes.
 * You may not create derivative versions of the software without written permission of the author.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; 
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * 
 * Grooveshark imagery and related media is Copyright (C) Escape Media Group. 
 * "Grooveshark" and Grooveshark Logos are trademarks of Escape Media Group.
 */
var recieveMessage, sendRequest, inject, tabnavListener;
var debug = false;
var thisVersion = '1.3.10';
function inject_sharkzapper() {
    if(debug) console.log("injecting sharkzapper version "+thisVersion);
    sendRequest({"command": "getTabCount"});

    function receiveMessage(e) {
        if (e.origin != "http://listen.grooveshark.com") return;
	    var request = JSON.parse(e.data);
        if (debug) console.log('sharkzapper:', '<(M)C<', request);
	    switch (request.command) {
		    case 'contentScriptInit':
		    case 'statusUpdate':
            case 'settingsUpdate':
		    case 'firstTabNavigate':
            case 'notification':
            case 'interactionTimePrompt':
            case 'fetchView':
            case 'fetchSettings':
			    sendRequest(request);
                break;
            case 'removeListener':
                window.removeEventListener("message",receiveMessage,false);
                window.removeEventListener("close",handleClose,false);
                chrome.extension.onRequest.removeListener(recieveRequest);
                receiveMessage = function(e){ console.error('got messages from dead function',e); };
                receiveRequest = function(e){ console.error('got requests from dead function',e); };
                if (request.injectNew) {
                    if (debug) console.log("cleanup stage2 done! attempting to inject new sharkzapper (not done by us - sending message)");
                } else {
                    if (debug) console.log("cleanup stage2 done! leaving.");
                }
                sendMessage({"command":"cleanupDone","injectNew":request.injectNew});
                sendRequest({"command":"cleanupDone","injectNew":request.injectNew});
                break;
	    }
    }

    function sendMessage(message) {
        if (debug) console.log('sharkzapper:', '>(M)C>', message);
        window.postMessage(JSON.stringify(message), "http://listen.grooveshark.com");
    }

    function recieveRequest(request, sender, sendResponse) {
        if (debug) console.log('sharkzapper:', '<(R)C<', request, sender);
        //if (request.source != "page") return;
	    switch (request.command) {
		    case 'prevSong':
		    case 'pauseSong':
		    case 'playSong':
		    case 'resumeSong':
		    case 'nextSong':
		    case 'updateStatus':
		    case 'toggleMute':
            case 'togglePlayPause':
		    case 'performSearch':
		    case 'addToLibrary':
		    case 'removeFromLibrary':
		    case 'addToSongFavorites':
		    case 'removeFromSongFavorites':
            case 'toggleSmile':
            case 'toggleFrown':
            case 'interactionTimeResume':
            case 'settingsUpdate':
            case 'viewUpdate':
            case 'volumeUpdate':
            case 'setShuffle':
            case 'setCrossfadeEnabled':
            case 'setRepeat':
            case 'mobileBinded':
			    sendMessage(request);
			    break;
		    case 'tabCount':
			    if (debug) console.log('There are ' + request.tabCount + ' open grooveshark tabs!');
			    if (request.tabCount != 1) {
				    if (!document.getElementById('sharkzapper_warning_bar')) {
					    warn = document.createElement('div');
					    warn.id = 'sharkzapper_warning_bar';
					    warn.innerHTML = '<div style="position: absolute; top: 0px; z-index: 100000; color: black; width: 100%; text-align: center; font-size: 120%; padding: 12px; background-color: rgba(255, 255, 224, 0.8); ">Grooveshark is already open in <a href="http://listen.grooveshark.com/" onclick="window.postMessage(JSON.stringify({\'command\':\'firstTabNavigate\'}), \'http://listen.grooveshark.com\'); ">another tab</a>, please close this tab if you wish to use SharkZapper. <span style="float:right; margin-right: 24px;"><a href="#/" onclick="document.body.removeChild(document.getElementById(\'sharkzapper_warning_bar\'));">close</a></span></div>';
					    document.body.appendChild(warn);
                        window.addEventListener("message", tabnavListener, false);  // listen for "firstTabNavigate" message 
                                                                                    // can't rely on normal listener as it will be cleaned up by clean_up()
				    }
				    if (document.getElementById('sharkzapperInject')) { clean_up(); }
			    }
			    break;
	    }
    }

    function sendRequest(request) {
        if (!request.source) request.source = "contentscript";
        if (debug) console.log('sharkzapper:', '>(R)C>', request);
        chrome.extension.sendRequest(request);
    }

    function handleClose() {
        sendRequest({"command":"gsTabClosing"});
    }

    window.addEventListener("message", receiveMessage, false);
    window.addEventListener("unload", handleClose, false);    

    chrome.extension.onRequest.addListener(recieveRequest);

    inject = document.createElement('script');
    inject.id = 'sharkzapperInject'; 
    inject.className = 'version_'+thisVersion;
    inject.innerHTML = '    var sharkzapper_debug = false;\
                            var sharkzapper_mobile_id = null;\
                            function sharkzapper_update_status() {\
                                gs_status = {\
					                "command": "statusUpdate",\
					                "playbackStatus": GS.player.getPlaybackStatus(),\
					                "currentSong": GS.player.currentSong,\
					                "isPlaying": GS.player.isPlaying,\
					                "isPaused": GS.player.isPaused,\
					                "isMuted": GS.player.getIsMuted(),\
					                "volume": GS.player.getVolume(),\
					                "shuffle": GS.player.getShuffle(),\
					                "repeat": GS.player.getRepeat(),\
					                "crossfade": GS.player.getCrossfadeEnabled()\
				                };\
				                if (GS.player.currentSong) {\
					                gs_status.urls = {"song": GS.player.currentSong.toUrl()};\
				                    gs_status.urls.artist = _.cleanUrl(gs_status.currentSong.ArtistName, gs_status.currentSong.ArtistID, "artist");\
			                        gs_status.urls.album = _.cleanUrl(gs_status.currentSong.AlbumName, gs_status.currentSong.AlbumID, "album");\
				                }\
                                if (GS.player.queue) {\
					                gs_status.prevSong = GS.player.queue.previousSong;\
					                gs_status.nextSong = GS.player.queue.nextSong;\
					                gs_status.queueLength = GS.player.queue.songs.length;\
                                }\
                                if ($("#queue_list li.queue-item-active div.radio_options").hasClass("active")) {\
                                    gs_status.isRadio = true;\
                                    gs_status.isSmile = $("#queue_list li.queue-item-active div.radio_options a.smile").hasClass("active");\
                                    gs_status.isFrown = $("#queue_list li.queue-item-active div.radio_options a.frown").hasClass("active");\
                                } else {\
                                    gs_status.isRadio = false;\
                                }\
				                sharkzapper_post_message(gs_status);\
		                    }\
			                function sharkzapper_post_message(message) {\
                                if (sharkzapper_debug) console.log("sharkzapper:", ">P>", message);\
				                message.source = "page";\
				                window.postMessage(JSON.stringify(message), "http://listen.grooveshark.com");\
			                }\
                            function sharkzapper_handle_notification(n) {\
                                n.command="notification";\
                                sharkzapper_post_message(n);\
                            }\
                            function sharkzapper_settings_callback(r) {\
                                if (!GS.Controllers.Page.SettingsController.instance().sharkzapperSettings) {\
                                    sharkzapper_post_message({"command":"fetchfetchSettingsSettings", "callback":"sharkzapper_settings_callback"});\
                                } else {\
                                    GS.Controllers.Page.SettingsController.instance().showSharkzapper();\
                                }\
                            }\
					        function sharkzapper_handle_message(e) {\
						        if (e.origin == "http://listen.grooveshark.com") {\
							        var request = JSON.parse(e.data);\
							        if (request.source == "page") { return; }\
							        if (sharkzapper_debug) console.log("sharkzapper:", "<P<", request);\
							        switch (request.command) {\
								        case "pauseSong":\
									        GS.player.pauseSong();\
									        break;\
								        case "resumeSong":\
									        GS.player.resumeSong();\
									        break;\
								        case "prevSong":\
									        GS.player.previousSong();\
									        break;\
									    case "playSong":\
									        GS.player.playSong();\
								            break;\
								        case "nextSong":\
									        GS.player.nextSong();\
									        break;\
								        case "updateStatus":\
									        sharkzapper_update_status();\
									        break;\
								        case "togglePlayPause":\
								            if(GS.player.isPaused) {\
								                GS.player.resumeSong();\
							                } else if(GS.player.isPlaying){\
							                    GS.player.pauseSong();\
							                } else {\
							                    GS.player.playSong();\
						                    }\
								            break;\
								        case "toggleMute":\
									        $("#player_volume").click();\
									        sharkzapper_update_status();\
									        break;\
								        case "volumeUpdate":\
								            GS.player.setVolume(request.volume);\
								            break;\
								        case "addToLibrary":\
									        if (request.songId) GS.user.addToLibrary(request.songId);\
									        break;\
								        case "removeFromLibrary":\
									        if (request.songId) GS.user.removeFromLibrary(request.songId);\
									        break;\
								        case "addToSongFavorites":\
									        if (request.songId) GS.user.addToSongFavorites(request.songId);\
									        break;\
								        case "removeFromSongFavorites":\
									        if (request.songId) GS.user.removeFromSongFavorites(request.songId);\
									        break;\
                                        case "toggleSmile":\
                                            $("#queue_list li.queue-item-active div.radio_options a.smile").click();\
                                            break;\
                                        case "toggleFrown":\
                                            $("#queue_list li.queue-item-active div.radio_options a.frown").click();\
                                            break;\
								        case "performSearch":\
									        GS.router.performSearch("all",request.query);\
									        break;\
								        case "interactionTimeResume":\
    								        GS.player.resumeSong();\
								            GS.lightbox.close();\
								            break;\
							            case "viewUpdate":\
							                $.View.preCached["_gs_views_" + request.viewName + "_ejs"] = request.view;\
							                if (request.callback && typeof this[request.callback] == "function") this[request.callback].call(this,request);\
							                break;\
						                case "settingsUpdate":\
						                    GS.Controllers.Page.SettingsController.instance().sharkzapperSettings = request.settings;\
							                if (request.callback && typeof this[request.callback] == "function") this[request.callback].call(this,request);\
						                    break;\
					                    case "setShuffle":\
					                        if (request.shuffle == undefined) { if(debug){console.error("setShuffle called without shuffle parameter");}return; }\
					                        GS.player.setShuffle(request.shuffle);\
					                        break;\
				                        case "setCrossfadeEnabled":\
				                            if (request.enabled == undefined) { if(debug){console.error("setCrossfadeEnabled called without enabled parameter");}return; }\
			                                if (GS.user.UserID <= 0 || !GS.user.IsPremium){GS.lightbox.open("vipOnlyFeature"); return;}\
			                                GS.player.setCrossfadeEnabled(request.enabled);\
			                                break;\
		                                case "setRepeat":\
		                                    if (request.repeatMode == undefined) { if (debug){console.error("setRepeat called without repeatMode parameter");} return; }\
	                                        if (typeof request.repeatMode == "string" && request.repeatMode.substring(0,7) == "REPEAT_") {\
	                                            request.repeatMode = GS.player[request.repeatMode];\
	                                        }\
	                                        GS.player.setRepeat(request.repeatMode);\
	                                        if (request.repeatMode === GS.player.REPEAT_ALL) $("#player_loop").removeClass("none").removeClass("one").addClass("all").addClass("active");\
                                            else if (request.repeatMode === GS.player.REPEAT_ONE) $("#player_loop").removeClass("all").addClass("one").addClass("active");\
                                            else request.repeatMode === GS.player.REPEAT_NONE && $("#player_loop").removeClass("one").addClass("none").removeClass("active");\
	                                        break;\
                                        case "mobileBinded":\
                                            sharkzapper_mobile_id = request.sharkId;\
                                            break;\
							        }\
						        }\
					        }\
                            window.addEventListener("message", sharkzapper_handle_message, false);\
                            if(!GS.player.playerStatus_) {\
                                GS.player.playerStatus_=GS.player.playerStatus;\
                            }\
                            GS.player.playerStatus=function(b){GS.player.playerStatus_(b);sharkzapper_update_status();};\
                            if(!GS.lightbox.open_) {\
                                GS.lightbox.open_=GS.lightbox.open;\
                            }\
                            GS.lightbox.open=function(a,b){GS.lightbox.open_(a,b);if(a=="interactionTime"){sharkzapper_post_message({"command":"interactionTimePrompt"})}};\
                            $.subscribe("gs.notification",sharkzapper_handle_notification);\
					        $.subscribe("gs.player.queue.change",sharkzapper_update_status);\
                            $.subscribe("gs.auth.song.update",sharkzapper_update_status);\
                            $.subscribe("gs.auth.favorites.songs.add",sharkzapper_update_status);\
                            $.subscribe("gs.auth.favorites.songs.remove",sharkzapper_update_status);\
                            $.subscribe("gs.auth.library.add",sharkzapper_update_status);\
                            $.subscribe("gs.auth.library.remove",sharkzapper_update_status);\
                            \
                            $(".queueSong .smile, .queueSong .frown").click(sharkzapper_update_status);\
                            \
                            if (!GS.Controllers.Page.SettingsController.instance().index_) { GS.Controllers.Page.SettingsController.instance().index_ = GS.Controllers.Page.SettingsController.instance().index; }\
                            if (!GS.Controllers.Page.SettingsController.instance().loadSettings_) { GS.Controllers.Page.SettingsController.instance().loadSettings_ = GS.Controllers.Page.SettingsController.instance().loadSettings; }\
                            GS.Controllers.Page.SettingsController.instance().index = function(a) {\
                                if ($("#page").is(".gs_page_settings")) {\
                                    this.pageType = a || "profile";\
                                    console.log("gs.page.settings", GS.user);\
                                    if (!GS.user.isLoggedIn) if (this.pageType !== "preferences" && this.pageType !== "subscriptions" && this.pageType !== "sharkzapper") this.pageType = "preferences";\
                                    GS.user.settings.getUserSettings(this.callback("loadSettings"), GS.router.notFound);\
                                    this.subscribe("gs.auth.update", this.callback("index"));\
                                    this.subscribe("gs.auth.favorites.users.update", this.callback("updateActivityUsersForm"));\
                                    this.subscribe("gs.facebook.profile.update", this.callback("updateFacebookForm"));\
                                    this.subscribe("gs.lastfm.profile.update", this.callback("updateLastfmForm"));\
                                    this.subscribe("gs.google.profile.update", this.callback("updateGoogleForm"));\
                                    this.subscribe("gs.settings.upload.onload", this.callback("iframeOnload"));\
                                }\
                            };\
                            GS.Controllers.Page.SettingsController.instance().loadSettings = function () {\
                                if ($("#page").is(".gs_page_settings")) {\
                                    this.user = GS.user;\
                                    this.settings = GS.user.settings;\
                                    this.element.html(this.view("index"));\
                                    var panes = this.element.find("#page_nav_vertical #settings_sections");\
                                    if(!panes.children("li.pane_sharkzapper").length) {\
                                        panes.append(\'<li class="pane pane_sharkzapper"><a href="#/settings/sharkzapper"><span class="icon" style="background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9oMFwQbH1R4eX0AAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAD0klEQVQ4y12Ma0xbZRiA3+/raSstlN7g2CMUjkw3wyUkmzNGUG6Zi4kLUVzikvnHaNwPxJgxw7YfExRMiEYzjcmSZUFINLqAYzNmXEK7hEi5lQK6gfQCraO0PaelLaftTr/z+WuJ8fn9PA+ilML/UC/Ozx+z2WxX8vl8myzLkM1kprx+f+/LjY1LxSZTHmP82EXoPwPk83rrY7FYTyAQeN0fCEQT8biAEAKDwWBhWdZmNBjGKFUG33jrtPtkW/WR7k8GvMzj+u+NjfZlt/vH5eXlv9xud9fU9PTd6tpa4ZmqKiaeSNitZnNLJc+/V2otcXz+WXdPal8s8Xk3v0SUUlhbXa1dWFhwORyOW8MjIx85Z2a+D4VCCzaOu9Hc0hIGAC0AkM7OztqDtDT4dOlua1UZfvXtzjuzeDsQ0KytrV1aXFxc83g8Fyiley6X65XAzk7fPadz8vq1ay8BAKaUFn519arvqGnuZyUpwoSbPbu+vv4E/nV09LB3a6tjZWXlhmd1NQgAkE6n8zzPq8wWS83c/Pyty5cuPo8QUt/84p3ntKL/ikTtc3lZPnN7fPwQlvP5T7e83pB/e3saAGB8bMxCAayiKIK19ElaZ0MWYXPGefliDx+V/hgqrWFnsa3tW7WayblcrvP44e7uqb29PUEBCAIAxATh7IEkYUmSqH/rPmo4rqa9fdVgZqfGT5+zW35Z6ek7XlcS0mo00VQq9Rr+JxTCuVyuoLWpqczjdp/YCQbPp5JJEMUEwvkQVNUzqISX6MddRravl0SHR973FxcXazVarSqbzWKV0Wh8IZvLvchxXPvG5uYZr8/H6vWFFIOETjYQcDgfQpU+jabvIph2mYoWXLMNusLC5o0HD2oi0eiEymKx3Jdl+V1FUUyiKBYwDAOZTAaZtTE4ZH0EP/yuhfpjMbh+00qLjEZGEMXKcDhcEY/HSXl5+Qe4sqLiz/1EYkwUBMhkMlQQBJCScWh/9gC+/kkCxBA4140hJSkoLopACAGMMUiSdKerq2sDUUqx3W4/SgiZsFqtRlnG9MMOM9rZxTC1ngWdVgUMw4Asy4AQok9xHMpks/tFRUVvDg0NuTEAwOjo6AohpDMcjiaO8DkUjKdheDIIqUSURiIRGolEACEELMsiKZNJJpPJC/39/R4AIIgQgjHGyOvbYVqamxoP2+XvgjE9r9Pp1QzDgEajAZ1OBwzDkFQqNclx3DcDAwOLPM8/opQqQCnFiqKoKKXMvd9uGwb7+6x1dXWnWJZ1chwnl5WVyXa73dHa2tqxtLTEEkJMlFKDoih6SmnBv/eM+oTo5p/0AAAAAElFTkSuQmCC) no-repeat;"></span><span class="text">sharkZapper</span><span class="arrow"></span></a></li>\');\
                                    }\
                                    switch (this.pageType) {\
                                        case "profile":\
                                            GS.Controllers.PageController.title("Settings");\
                                            this.showProfile();\
                                            break;\
                                        case "password":\
                                            GS.Controllers.PageController.title("Change Password");\
                                            this.showPassword();\
                                            break;\
                                        case "preferences":\
                                            GS.Controllers.PageController.title("Preferences");\
                                            this.showPreferences();\
                                            break;\
                                        case "services":\
                                            GS.Controllers.PageController.title("Services Settings");\
                                            this.showServices();\
                                            break;\
                                        case "activity":\
                                            GS.Controllers.PageController.title("Activity Settings");\
                                            this.showActivity();\
                                            break;\
                                        case "subscriptions":\
                                            GS.Controllers.PageController.title("Subscriptions Settings");\
                                            GS.service.getSubscriptionDetails(this.callback("showSubscriptions"), this.callback("showSubscriptions"));\
                                            break;\
                                        case "extras":\
                                            GS.Controllers.PageController.title("Extras");\
                                            this.showExtras();\
                                            break;\
                                        case "sharkzapper":\
                                            GS.Controllers.PageController.title("sharkZapper Settings");\
                                            this.showSharkzapper();\
                                            break;\
                                    }\
                                }\
                            };\
                            GS.Controllers.Page.SettingsController.instance().showSharkzapper = function() {\
                                if ($.View.preCached._gs_views_settings_sharkzapper_ejs) {\
                                    this.element.find("#page_pane").html(this.view("sharkzapper"));\
                                    $("#settings_sharkzapper").submit(function(e){\
                                        e.preventDefault();\
                                        if (!GS.Controllers.Page.SettingsController.instance().sharkzapperSettings) {\
                                            console.error("no sharkzapper settings! what?");\
                                            $("#settings_sharkzapper .buttons .status").addClass("failure");\
                                            $.publish("gs.notification", {\
                                                type: "error",\
                                                message: $.localize.getString("POPUP_UNABLE_SAVE_SETTINGS")\
                                            });\
                                            return;\
                                        }\
                                        GS.Controllers.Page.SettingsController.instance().sharkzapperSettings.newTabOnPopupClick = $("#settings_sharkzapper_newTabOnPopupClick").is(":checked");\
                                        GS.Controllers.Page.SettingsController.instance().sharkzapperSettings.showMuteButton = $("#settings_sharkzapper_showMuteButton").is(":checked");\
                                        GS.Controllers.Page.SettingsController.instance().sharkzapperSettings.showQueuePosition = $("#settings_sharkzapper_showQueuePosition").is(":checked");\
                                        GS.Controllers.Page.SettingsController.instance().sharkzapperSettings.showNotificationOnSongChange = $("#settings_sharkzapper_showNotificationOnSongChange").is(":checked");\
                                        GS.Controllers.Page.SettingsController.instance().sharkzapperSettings.showVolumeControlOnHover = $("#settings_sharkzapper_showVolumeControlOnHover").is(":checked");\
                                        GS.Controllers.Page.SettingsController.instance().sharkzapperSettings.showSearchBox = $("#settings_sharkzapper_showSearchBox").is(":checked");\
                                        GS.Controllers.Page.SettingsController.instance().sharkzapperSettings.showQueueButtons = $("#settings_sharkzapper_showQueueButtons").is(":checked");\
                                        GS.Controllers.Page.SettingsController.instance().sharkzapperSettings.showPlaybackButtons = $("#settings_sharkzapper_showPlaybackButtons").is(":checked");\
                                        GS.Controllers.Page.SettingsController.instance().sharkzapperSettings.showAlbumArt = $("#settings_sharkzapper_showAlbumArt").is(":checked");\
                                        GS.Controllers.Page.SettingsController.instance().sharkzapperSettings.enableSharkzapperMobile = $("#settings_sharkzapper_enableSharkzapperMobile").is(":checked");\
                                        sharkzapper_post_message({"command":"settingsUpdate","settings":GS.Controllers.Page.SettingsController.instance().sharkzapperSettings});\
                                        $("#settings_sharkzapper .buttons .status").addClass("success");\
                                    });\
                                } else {\
                                    sharkzapper_post_message({"command":"fetchView","viewName":"settings_sharkzapper","callback":"sharkzapper_settings_callback"});\
                                }\
                                this.element.find("#page_nav_vertical #settings_sections li.pane_sharkzapper a").addClass("active");\
                                $(window).resize();\
                            };\
                            $("#lightbox_wrapper .lbcontainer").parent().append("<div class=\\"lbcontainer sharkzapperMobileWarning\\" style=\\"display:none;\\"></div>");\
                            \
                            GS.Controllers.BaseController.extend("GS.Controllers.Lightbox.SharkzapperMobileWarningController", {\
                                onDocument: false\
                            }, {\
                                init: function () {\
                                    this.update()\
                                },\
                                update: function () {\
                                    console.log("lb.mobilewarning.init");\
                                    this.element.html(this.view("/lightbox/sharkzapperMobileWarning"))\
                                },\
                                ".submit click": function (a, b) {\
                                    console.log(".submit.click mobile warning");\
                                    $("#settings_sharkzapper_enableSharkzapperMobile").attr("checked","checked");\
                                    b.preventDefault();\
                                    b.stopPropagation();\
                                    GS.lightbox.close()\
                                }\
                            });\
                            \
                            sharkzapper_post_message({"command":"fetchView","viewName":"lightbox_sharkzapperMobileWarning"});\
                            if (location.hash == "#/settings/sharkzapper") GS.Controllers.Page.SettingsController.instance().index("sharkzapper");\
               				sharkzapper_post_message({"command":"contentScriptInit"});';
    document.body.appendChild(inject);
}
function clean_up(injectNew) {
    if (debug) console.log('running cleanup with injectNew:', injectNew);		
    // add listener to run injection when done cleaning up
    window.addEventListener("message", cleanupDoneListener, false); 
    	
	// clean up old injection
    document.body.removeChild(document.getElementById('sharkzapperInject'));
    if (document.getElementById('sharkzapperInject')) { console.error('could not clean up! dying...'); return;}
    cleanup = document.createElement('script');
    cleanup.id = 'sharkzapperCleanUp'; 
    cleanup.className = 'version_'+thisVersion;
    js = 'window.removeEventListener("message",sharkzapper_handle_message,false);';
    if (injectNew) {
        js += 'sharkzapper_post_message({"command":"removeListener","injectNew":true});';
    } else {
        js += 'sharkzapper_post_message({"command":"removeListener","injectNew":false});';
    }
    js += '             $.unsubscribe("gs.notification",sharkzapper_handle_notification);\
				        $.unsubscribe("gs.player.nowplaying",sharkzapper_update_status);\
				        $.unsubscribe("gs.player.queue.change",sharkzapper_update_status);\
				        $.unsubscribe("gs.player.playing.continue",sharkzapper_update_status);\
				        $.unsubscribe("gs.player.paused",sharkzapper_update_status);\
                        $.unsubscribe("gs.auth.song.update",sharkzapper_update_status);\
                        $.unsubscribe("gs.auth.favorites.songs.add",sharkzapper_update_status);\
                        $.unsubscribe("gs.auth.favorites.songs.remove",sharkzapper_update_status);\
                        $.unsubscribe("gs.auth.library.add",sharkzapper_update_status);\
                        $.unsubscribe("gs.auth.library.remove",sharkzapper_update_status);\
                        delete $.View.preCached._gs_views_settings_sharkzapper_ejs;\
                        if (GS.player.playerStatus_) { GS.player.playerStatus = GS.player.playerStatus_; }\
                        if (GS.lightbox.open_) { GS.lightbox.open = GS.lightbox.open_; }\
                        if (GS.Controllers.Page.SettingsController.instance().index_) { GS.Controllers.Page.SettingsController.instance().index = GS.Controllers.Page.SettingsController.instance().index_; }\
                        if (GS.Controllers.Page.SettingsController.instance().loadSettings_) { GS.Controllers.Page.SettingsController.instance().loadSettings = GS.Controllers.Page.SettingsController.instance().loadSettings_; }\
                        document.body.removeChild(document.getElementById("sharkzapperCleanUp"));\
                        if (sharkzapper_debug) console.log("cleanup stage1 done!");';
    cleanup.innerHTML=js;
    document.body.appendChild(cleanup);
    
}
function tabnavListener(e){
    if (e.origin != "http://listen.grooveshark.com") return;
    var request = JSON.parse(e.data)
    if (request.command != 'firstTabNavigate') return;
    chrome.extension.sendRequest(request);
    window.removeEventListener("message",tabnavListener,false);
}
function cleanupDoneListener(e){
    if (e.origin != "http://listen.grooveshark.com") return;
    var request = JSON.parse(e.data)
    if (request.command != 'cleanupDone') return;
    window.removeEventListener("message",cleanupDoneListener,false);
    if (debug) console.log("got cleanupDone message, inject new:",request.injectNew);
    if (request.injectNew) { inject_sharkzapper(); }
}
if (window.location.pathname != "/sidebar.php") {
    var inject = document.getElementById('sharkzapperInject');
    if (inject && (debug || inject.className != 'version_'+thisVersion)) {
        if (debug) console.log('sharkzapper already injected ('+inject.className+'), trying to remove and replace with us! (crosses fingers)');			
        if (inject.className == '') {   //workaround for broken injection behaviour in version 1.2.7 and below
            if (debug) console.log('sharkzapper pre-1.2.7 injected, attempting to workaround broken injection behaviour');
            clean_up(false);
            setTimeout(inject_sharkzapper,500); //hopefully should have cleaned up by 500ms.
        } else {
            clean_up(true);
        }
    } else {
        if (!inject) inject_sharkzapper();
    }
}
