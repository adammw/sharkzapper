/*
 * sharkzapper_songnotification.js
 * This is the songnotification script for sharkZapper which handles the UI of the song notifications
 *
 * sharkZapper is Copyright (C) 2011 Adam Malcontenti-Wilson <adman.com@gmail.com>
 * You are hereby granted a licence to use the software as-is, and view the source code for educational purposes.
 * You may not create derivative versions of the software without written permission of the author.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; 
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * 
 * Grooveshark imagery and related media is Copyright (C) Escape Media Group. 
 * "Grooveshark" and Grooveshark Logos are trademarks of Escape Media Group.
 */
var sharkzapper = (function SharkZapperSongNotification(debug) {
	var sharkzapper = this;
	sharkzapper.ui = {
		timeouts: {
            scrollables: [],
            volumeSlider: null
        },
		ready: function() {
			var songData = JSON.parse(location.hash.substring(1));
			$("#songName")[0].innerText = songData.SongName;
			$("#artistName")[0].innerText = songData.ArtistName;
			$("#albumName")[0].innerText = songData.AlbumName;
			if (songData.artPath && songData.CoverArtFilename) {
				$('#albumArt')[0].src = songData.artPath + 's' + songData.CoverArtFilename;
			}
			$(".buttons button").bind('click',sharkzapper.ui.buttonClick);
			sharkzapper.ui.updateScrollables();
		},
		buttonClick: function() {
			switch (this.id) {
				case 'prev':
					chrome.extension.sendRequest({"command":"prevSong"});
					window.close();
					break;
				case 'next':
					chrome.extension.sendRequest({"command":"nextSong"});
					window.close();
					break;
				case 'play':
					chrome.extension.sendRequest({"command":"togglePlayPause"});
					break;
			}
		},
		updateScrollables: function() {
			var scrollRate = 50;
			var scrollDelay = 3000;
			$(sharkzapper.ui.timeouts.scrollables).each(function(i,t) {
				clearTimeout(t);
			});
			//TODO: Delay start of next scroll until all three have finished scrolling
			$('.scrollable').each(function(i, el) {
				$(el).clearQueue().stop().css('marginLeft',0).children().not(':first-child').remove();
				var width = $(el).children().width();
				var clone = $(el).children().eq(0).clone();
				console.log($(el).width(),width);
				if (($(el).width()) >= width) return; //Ignore text that fits fine
				console.log('will scroll',el);
				$(el).append('<span class="sep"> - </span>');
				$(el).append(clone);
				width += $(el).children().eq(1).width();
				console.log('elwidth',$(el).width(),'width',width);
				(function animate() {
					$(el).animate({marginLeft: -width}, width*scrollRate, 'linear', function() {
						$(this).delay(1).css('marginLeft', 0);
						sharkzapper.ui.timeouts.scrollables.push(setTimeout(animate, scrollDelay));
					});
				})();
			});
		}
	};
	sharkzapper.init = function() {
		if (location.hash.length < 3) {
			console.error("No data in location.hash");
			return null;
		}
		document.addEventListener('DOMContentLoaded', sharkzapper.ui.ready);
		return sharkzapper;
	}	
	return sharkzapper.init();
})(true);