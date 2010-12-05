if (document.getElementById('sharkzapperInject')) {
	console.log('sharkzapper already injected, trying to remove and replace with us!');			
	// clean up old injection
    document.body.removeChild(document.getElementById('sharkzapperInject'));
    cleanup = document.createElement('script');
    cleanup.id = 'sharkzapperCleanUp'; 
    cleanup.innerHTML = 'sharkzapper_post_message({"command":"removeListener"});\
                        window.removeEventListener("message",sharkzapper_handle_message,false);\
                        $.unsubscribe("gs.player.nowplaying",sharkzapper_update_status);\
					    $.unsubscribe("gs.player.queue.change",sharkzapper_update_status);\
					    $.unsubscribe("gs.player.playing.continue",sharkzapper_update_status);\
					    $.unsubscribe("gs.player.paused",sharkzapper_update_status);\
                        document.body.removeChild(document.getElementById("sharkzapperCleanUp")); ';
    document.body.appendChild(cleanup);
    // continue and inject new stuff
}

chrome.extension.sendRequest({"command": "getTabCount"});

function receiveMessage(e) {
	var request = JSON.parse(e.data);
	switch (request.command) {
		case 'contentScriptInit':
		case 'statusUpdate':
		case 'firstTabNavigate':
			chrome.extension.sendRequest(request);
            break;
        case 'removeListener':
            window.removeEventListener(receiveMessage);
            receiveMessage = function(e){ console.log('got messages from dead function',e); };
            break;
	}
}
window.addEventListener("message", receiveMessage, false);  

chrome.extension.onRequest.addListener(
	function(request, sender, sendResponse) {
		switch (request.command) {
			case 'prevSong':
			case 'pauseSong':
			case 'resumeSong':
			case 'nextSong':
			case 'updateStatus':
			case 'toggleMute':
			case 'performSearch':
			case 'addToLibrary':
			case 'removeFromLibrary':
			case 'addToSongFavorites':
			case 'removeFromSongFavorites':
				window.postMessage(JSON.stringify(request), "http://listen.grooveshark.com");
				break;
			case 'tabCount':
				console.log('There are ' + request.tabCount + ' open grooveshark tabs!');
				if (request.tabCount != 1) {
					if (!document.getElementById('sharkzapper_warning_bar')) {
						warn = document.createElement('div');
						warn.id = 'sharkzapper_warning_bar';
						warn.innerHTML = '<div style="position: absolute; top: 0px; z-index: 100000; color: black; width: 100%; text-align: center; font-size: 120%; padding: 12px; background-color: rgba(255, 255, 224, 0.8); ">Grooveshark is already open in <a href="javascript:window.postMessage(JSON.stringify({\'command\':\'firstTabNavigate\'}), \'http://listen.grooveshark.com\'); ">another tab</a>, please close this tab if you wish to use SharkZapper. <span style="float:right; margin-right: 24px;"><a href="javascript:document.body.removeChild(document.getElementById(\'sharkzapper_warning_bar\'));">close</a></span></div>';
						document.body.appendChild(warn);
					}
					if (document.getElementById('sharkzapperInject')) { document.body.removeChild(document.getElementById('sharkzapperInject')); }
				}
				break;
		}
	}
);

inject = document.createElement('script');
inject.id = 'sharkzapperInject'; //if($('#player_play_pause').hasClass('pause'))
inject.innerHTML = '    function sharkzapper_update_status() {\
				            current_song = GS.player.currentSong;\
				            if (current_song) {\
					            current_song.fromLibrary = GS.user.library.songs.hasOwnProperty(current_song.SongID);\
					            current_song.isFavorite = GS.user.favorites.songs.hasOwnProperty(current_song.SongID);\
				            }\
				            sharkzapper_post_message({\
					            "command": "statusUpdate",\
					            "playbackStatus": GS.player.getPlaybackStatus(),\
					            "currentSong": current_song,\
					            "prevSong": GS.player.queue.previousSong,\
					            "nextSong": GS.player.queue.nextSong,\
					            "isPlaying": GS.player.isPlaying,\
					            "isPaused": GS.player.isPaused,\
					            "isMuted": GS.player.getIsMuted()\
				            });\
		                }\
			            function sharkzapper_post_message(message) {\
				            message.source = "page";\
				            window.postMessage(JSON.stringify(message), "http://listen.grooveshark.com");\
			            }\
					    function sharkzapper_handle_message(e) {\
						    if (e.origin == "http://listen.grooveshark.com") {\
							    var request = JSON.parse(e.data);\
							    if (request.source == "page") { return; }\
							    console.log("sharkzapper:", "<<<", request);\
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
								    case "nextSong":\
									    GS.player.nextSong();\
									    break;\
								    case "updateStatus":\
									    sharkzapper_update_status();\
									    break;\
								    case "toggleMute":\
									    $("#player_volume").click();\
									    sharkzapper_update_status();\
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
								    case "performSearch":\
									    GS.router.performSearch("all",request.query);\
									    break;\
							    }\
						    }\
					    }\
                        window.addEventListener("message", sharkzapper_handle_message, false);\
					    sharkzapper_post_message({"command":"contentScriptInit"});\
					    $.subscribe("gs.player.nowplaying",sharkzapper_update_status);\
					    $.subscribe("gs.player.queue.change",sharkzapper_update_status);\
					    $.subscribe("gs.player.playing.continue",sharkzapper_update_status);\
					    $.subscribe("gs.player.paused",sharkzapper_update_status);';
document.body.appendChild(inject);
