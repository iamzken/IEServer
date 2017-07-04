/*
 * localoptions.js
 *
 * This is executed in the extension's options.html page.
 * Note that it's different from the options.js script which is executed as a content
 * script in ietab.net's options.html page
 *
 * The local options page just loads the one from ietab.net
 *
 */
function getInitUrl()
{
    var myUrl = document.location.href;
    var regex = /[?&]initial=([^&].*)/;
    var match = myUrl.match(regex);
    if(match)
        return match[1];
    else
        return "";
}

var url = "http://www.ietab.net/options";

var initUrl = getInitUrl();
if(initUrl)
    url += "?initial=" + initUrl;

window.top.location = url;
