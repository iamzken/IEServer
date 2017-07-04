/*
 *
 * settings.js
 *
 * Place to get general user settings.
 * This includes all configurable user settings that may have been set
 * with the Enterprise Configuration Manager.
 *
*/
var Settings = {
    settingsLoaded: false,

    DEFAULT_SETTINGS: {
        'disable-intro-page': false,
        'enable-auto-urls': true,
        'enable-chrome-popups': true,
        'settings-refresh-interval': 1000*60*10,    // Every 10 minutes
        'show-search-box': false,
        'enable-use-full-window-popups': true,
        'enable-dep': true,
        'enable-atl-dep': true,
        'only-auto-urls' : false,
        'hide-addr-bar' : false,
        'show-status-text' : false,
        'open-popups-in-tab': false,
        'allow-api-prompt': true,
        'enable-direct-invoke': false,
        'scripturl-mitigation': true,
        'cookie-sync': false,
        'single-session': false,
        'favicon': false,
        'beforeunload': false,
        'ietab-header': false
    },

    MERGED_SETTINGS: {
        'autourl-list': 1,
        'exclusion-list': 1,
        'api-whitelist': 1,
        'api-blacklist': 1
    },

    _initLocal: function() {
        // Mappings for old settings
        var settingsMap = {
            'compatMode': 'compat-mode',
            'enableAutoUrls': 'enable-auto-urls',
            'enableChromePopups': 'enable-chrome-popups',
            'showSearchBox': 'show-search-box',
            'disableAutoSearch': 'disable-auto-search',
            'filterUrls': 'autourl-list',
            'exclusionUrls': 'exclusion-list'
        }

        // If it already exists, then we're done
        var localSettings = IETAB.Storage.get('localSettings');
        if (localSettings && (typeof(localSettings) == 'object'))
            return localSettings;

        // Initialize it as empty and copy any old settings
        localSettings = {};
        for (var from in settingsMap) {
            var value = IETAB.Storage.get(from);
            if (value || (typeof(value) != 'object'))
                localSettings[settingsMap[from]] = value;

            // Delete the deprecated value
            // (We used to do this, but now keep it around in case there's a bug.  We can delete these much later
            //  after a successful upgrade)
            // IETAB.Storage.set(from, null);
        }
        IETAB.Storage.set('localSettings', localSettings);
        return localSettings;
    },

    _log: function(text) {
        Debug.log('Settings.' + text);
    },

    _updateCompatMode: function() {
        // If the compat mode changes, we need to update the registry
        var newMode = this.get('compat-mode');
        Background.onSetCompatMode(newMode);
    },

    _updateSpellCheck: function() {
        var value = this.get('spellcheck');
        Background.onSetSpellCheck(value);
    },

    _updateScriptMitigation: function() {
        var value = this.get('scripturl-mitigation');
        Background.onSetScriptMitigation(value);
    },

    _updateOpenInNewTab: function() {
        var value = this.get('open-in-new-tab');
        Background.onSetOpenInNewTab(value);
    },

    _onNewECMSettings: function() {
        this._updateCompatMode();
        this._updateSpellCheck();
        this._updateScriptMitigation();
        this._updateOpenInNewTab();
    },

    isCompatModeString: function(strMode) {
        var arrModes = ['IE7S', 'IE8S', 'IE8F', 'IE9S', 'IE9F', 'IE10S', 'IE10F', 'IE11S', 'IE11F' ];
        strMode = strMode.toUpperCase();

        return (arrModes.indexOf(strMode) != -1);
    },

    mapCompatModeString: function(strMode) {
        var nMode = 7000;
        if (!strMode)
            return nMode;

        strMode = strMode.toUpperCase();
        switch (strMode) {
            case "IE7S": nMode = 7000; break;
            case "IE8S": nMode = 8000; break;
            case "IE8F": nMode = 8888; break;
            case "IE9S": nMode = 9000; break;
            case "IE9F": nMode = 9999; break;
            case "IE10S": nMode = 10000; break;
            case "IE10F": nMode = 10001; break;
            case "IE11S": nMode = 11000; break;
            case "IE11F": nMode = 11001; break;
        }
        return nMode;
    },

    getAdvancedFilterOptions: function(filter) {
        var regex = /^\[([^\]]*)\]/;
        var match = filter.match(regex);
        if (!match)
            return null;
        return match[1].split(',');
    },

    getPerUrlMode: function(url) {
        var filter = Background.getAutoURLFilter(url);
        if (!filter)
            return 0;

        var options = this.getAdvancedFilterOptions(filter);
        if (!options)
            return 0;

        for (var i=0; i<options.length; i++) {
            if (this.isCompatModeString(options[i]))
                return this.mapCompatModeString(options[i]);
        }
        return 0;
    },

    mapRegKeyToECM: function(key, value) {
        var TYPE = {
            BOOL:        1,
            BOOL_INVERT: 2,
            INT :        3,
            STRING:      4,
            LIST:        5
        }
        var GPOToECM = {
            'ShowIntroPage':           [ TYPE.BOOL_INVERT, 'disable-intro-page'],
            'HideAddressBar':          [ TYPE.BOOL, 'hide-addr-bar' ],
            'EnableAutoURLs':          [ TYPE.BOOL, 'enable-auto-urls' ],
            'SettingsRefreshInterval': [ TYPE.INT,  'settings-refresh-interval'],
            'UseFullWindowPopups':     [ TYPE.BOOL, 'enable-use-full-window-popups' ],
            'OpenPopupsWithChrome':    [ TYPE.BOOL, 'enable-chrome-popups' ],
            'OpenPopupsInTab':         [ TYPE.BOOL, 'open-popups-in-tab' ],
            'EnableDEPPolicy':         [ TYPE.BOOL, 'enable-dep' ],
            'EnableATLDEPWorkaround':  [ TYPE.BOOL, 'enable-atl-dep' ],
            'OnlyOpenAutoURLs':        [ TYPE.BOOL, 'only-auto-urls' ],
            'ShowStatusText':          [ TYPE.BOOL, 'show-status-text' ],
            'IECompatibilityMode':     [ TYPE.STRING, 'compat-mode' ],
            'LicenseeName':            [ TYPE.STRING, 'licensee' ],
            'LicenseKey':              [ TYPE.STRING, 'license-key' ],
            'AllowApiPrompt':          [ TYPE.BOOL, 'allow-api-prompt' ],
            'EnableDirectInvoke':      [ TYPE.BOOL, 'enable-direct-invoke' ],
            'ScriptUrlMitigation':     [ TYPE.BOOL, 'scripturl-mitigation' ],
            'CookieSync':              [ TYPE.BOOL, 'cookie-sync' ],
            'Favicon':                 [ TYPE.BOOL, 'favicon' ],
            'BeforeUnload':            [ TYPE.BOOL, 'beforeunload' ],
            'SpellCheck':              [ TYPE.BOOL, 'spellcheck' ],
            'NeverOpenExceptions':     [ TYPE.BOOL, 'never-open-exceptions' ],
            'IETabHeader':             [ TYPE.BOOL, 'ietab-header' ],
            'OpenInNewTab':            [ TYPE.BOOL, 'open-in-new-tab' ],
            'SessionShare':            [ TYPE.BOOL, 'single-session' ],

            // List values are handled specially
            'AutoURLs':                [ TYPE.LIST, 'autourl-list' ],
            'AutoURLExceptions':       [ TYPE.LIST, 'exclusion-list'],
            'ApiWhitelist':            [ TYPE.LIST, 'api-whitelist' ]
        }

        // Back-compat hack.  The old ECM used adm-enable-only-auto-urls when it
        // should have used adm-only-auto-urls.  So we stick with that format
        // for this one special-case.
        if (key == 'AllowChangeOnlyOpenAutoURLs') {
            return { name: 'adm-enable-only-auto-urls', value: !!value };
        }

        // First check for a lockdown setting
        if (key.indexOf('AllowChange') == 0) {
            var testKey = key.substr(11);
            var entry = GPOToECM[testKey];
            if (entry) {
                // Convert the result to an ECM admin setting
                var result = {};
                result.name = 'adm-' + entry[1];
                result.value = !!value;

                // Lockdown setting found, we are done
                return result;
            }
        }

        // Not a lockdown setting, check for standard mapping
        var entry = GPOToECM[key];
        if (!entry) {
            // No ECM Mapping
            return null;
        }

        // Deal with lists first
        if (entry[0] == TYPE.LIST) {
            var result = { name: entry[1] };
            result.value = [];
            for (key in value) {
                result.value.push(value[key]);
            }
            return result;
        }

        // Not an admin setting and not a list
        var result = { name: entry[1] };
        switch(entry[0]) {
            case TYPE.BOOL:
                result.value = !!value;
                break;
            case TYPE.BOOL_INVERT:
                result.value = !value;
                break;
            case TYPE.INT:
                result.value = parseInt(value);
                break;
            case TYPE.STRING:
                result.value = value;
                break;
        }
        // Regular mapping, mapped and done, return the result
        return result;
    },

    /**
     *   regToECMSettings
     *
     *   Takes the registry settings JSON, validates, and merges and/or creates
     *   ECM-style settings JSON from them.
     *
     *   This supports backwards compatibility for the "EnterpriseSettings" REG_SZ value.
     *   But also supports the set of new standalone reg values which also take
     *   precedence.
    **/
    regToECMSettings: function(regSettings) {
        if (!regSettings || !regSettings.result || regSettings.error) {
            return null;
        }

        // Use the 'result'
        regSettings = regSettings.result;

        // Legacy support, first load the original ECM settings
        var ecmSettings = regSettings.EnterpriseSettings;
        if (ecmSettings) {
            try {
                // This is a REG_SZ value, parse it into JSON
                ecmSettings = JSON.parse(ecmSettings);
            } catch(ex) {
                ecmSettings = null;
            }
        }
        delete regSettings.EnterpriseSettings;

        for (var key in regSettings) {
            var ecmResult = this.mapRegKeyToECM(key, regSettings[key]);
            if (ecmResult) {
                if (!ecmSettings) {
                    ecmSettings = {};
                }
                ecmSettings[ecmResult.name] = ecmResult.value;
            }
        }
        return ecmSettings;
    },

    validateLicense: function(fnResult, licensee, key) {
        if (!licensee)
            licensee = this.get('licensee');
        if (!key)
            key = this.get('license-key');

        // No license or key, we're done
        if (!licensee || !key) {
            Background.licenseValid = false;
            fnResult(false);
            return;
        }

        if (Utils.dotVersionCompare(Background.helperVersion, '7.10.21.1') >= 0) {
            // Use the helper to validate the license
            NativeHostManager.sendWorkerMessage({
                    type: 'VALIDATE_LICENSE',
                    licensee: licensee,
                    key: key,
                }, function(msgResult) {
                Background.licenseValid = (msgResult && (msgResult.type == 'OK'));
                fnResult(Background.licenseValid);
            }.bind(this)
            );
        } else {
            // For now, with older helpers, we treat the license as valid
            Background.licenseValid = true;
            fnResult(true);
        }
    },

    processRegSettings: function(regSettings) {
        var ecmSettings = this.regToECMSettings(regSettings);
        if (!ecmSettings) {
            this._log('No Enterprise settings found, deleting local storage');
            IETAB.Storage.set('ECMSettings', null);
        } else {
            IETAB.Storage.set('ECMSettings', ecmSettings);
        }

        // Last step is to perform license validation
        this.validateLicense(function(result) {
            if (!result) {
                // No valid license, delete enterprise settings
                IETAB.Storage.set('ECMSettings', null);
            }
            if (!this.settingsLoaded) {
                if (this.onLoaded) {
                    this.onLoaded();
                }
            }
            this.settingsLoaded = true;
            this._onNewECMSettings();
        }.bind(this));
    },

    _mergeRegSettings: function(regSettings, newRegSettings) {
        if (newRegSettings && newRegSettings.result && !newRegSettings.error) {
            if (!regSettings || !regSettings.result || regSettings.error)
                regSettings = { result: {} };
            for (var key in newRegSettings.result) {
                // Replace any current registry setting with the higher priority setting
                regSettings.result[key] = newRegSettings.result[key];
            }
        }
        return regSettings;
    },

    _processPolicy: function() {
        // Use GET_REGKEY to get the HKCU and HKLM policy settings
        // Note that HKCU policy settings take precedence over HKCU user settings
        // and HKLM policy settings have the highest precedence
        NativeHostManager.sendWorkerMessage(
            {type: 'GET_REGKEY', hive: 'HKCU', path: 'Software\\IE Tab\\Enterprise\\Settings' },
            function(regSettings) {
                NativeHostManager.sendWorkerMessage(
                    {type: 'GET_REGKEY', hive: 'HKCU', path: 'Software\\Policies\\IE Tab\\IE Tab' },
                    function(hkcuRegSettings) {
                        regSettings = this._mergeRegSettings(regSettings, hkcuRegSettings);
                        NativeHostManager.sendWorkerMessage(
                            {type: 'GET_REGKEY', hive: 'HKLM', path: 'Software\\Policies\\IE Tab\\IE Tab' },
                            function(hklmRegSettings) {
                                regSettings = this._mergeRegSettings(regSettings, hklmRegSettings);
                                // Note that we get a result even if there is no native host.  That result
                                // will be { type: 'HOST_NOT_FOUND' }, so we end up calling processRegSettings
                                // with 'undefined' for the settings, which is fine.
                                this.processRegSettings(regSettings);
                            }.bind(this)
                        );
                    }.bind(this)
                );
            }.bind(this)
        );
    },

    _updateSettings: function() {
        this._log('_updateSettings');
        if (Background.useNativeHost()) {
            if (Utils.dotVersionCompare(Background.helperVersion, '7.10.21.1') >= 0) {
                this._processPolicy();
            } else {
                console.log("Using legacy enterprise settings");
                NativeHostManager.sendWorkerMessage({type: 'GET_ENTERPRISE_SETTINGS' }, function(entSettings) {
                    // Same comment above that we may call process with HOST_NOT_FOUND

                    // Convert result to the new reg format
                    var regSettings = {};
                    if (entSettings && (entSettings.type == 'ENTERPRISE_SETTINGS')) {
                        regSettings.result = {}
                        regSettings.result.EnterpriseSettings = entSettings.settings;
                    }
                    this.processRegSettings(regSettings);
                }.bind(this));
            }
            return;
        }
    },

    installECMTest: function(value) {
        IETAB.Storage.set('ECMTestSettings', value);
        // Deal with new settings
        this._onNewECMSettings();
    },

    _valueOrDefault: function(container, key) {
        if ( !container || (typeof(container[key]) == 'undefined') )
             return this.DEFAULT_SETTINGS[key];
         else
             return container[key];
    },

    getOneSpecial: function(key) {
        switch(key) {
            case 'license-valid':
                return Background.licenseValid;
            case 'helper-version':
                return Background.helperVersion;
            case 'permissions':
                return Background.permissions;
        }
        return null;
    },

    getOne: function(key) {
        // See if this a special, pre-defined setting
        var result = this.getOneSpecial(key);
        if (result || (typeof(result) == 'boolean')) {
            return result;
        }
        // Get both the local and the ECM settings
        var localSettings = IETAB.Storage.get('localSettings');
        // ECM Test settings override the ECM registry settings
        var ecmSettings = IETAB.Storage.get('ECMTestSettings');
        if (!ecmSettings)
            ecmSettings = IETAB.Storage.get('ECMSettings');

        // If they request local only, then give them local only
        if (key.indexOf('local-') === 0)
            return this._valueOrDefault(localSettings, key.substr(6));

        // If they request ecm only, then give them ecm only
        if (key.indexOf('ecm-') === 0)
            return this._valueOrDefault(ecmSettings, key.substr(4));

        // If no ECM settings, just return the local settings value
        if (!ecmSettings)
            return this._valueOrDefault(localSettings, key);

        // Check whether the ECM has disabled this key locally, if so, return the ECM value
        var enabledKey = 'adm-' + key;
        if (ecmSettings[enabledKey] === false)
            return this._valueOrDefault(ecmSettings, key);

        // If we don't have an ECM value, return the local one
        if (typeof(ecmSettings[key]) == 'undefined')
            return this._valueOrDefault(localSettings, key);

        // If we don't have a local value, return the ECM one
        if (!localSettings || (typeof(localSettings[key]) == 'undefined'))
            return ecmSettings[key];

        // If we got here then both values are defined

        // Deal with merged settings
        if (this.MERGED_SETTINGS[key]) {
            var result = ecmSettings[key];
            if (typeof(ecmSettings['adm-enable-' + key]) !== false)
                result = result.concat(localSettings[key]);
            // Remove duplicates
            result = result.filter(function(el, pos) {
                return result.indexOf(el) == pos;
            });
            return result;
        }

        // At this point we have both ECM and local values, it's not a merged value, and it hasn't been disabled,
        // so return the local one
        return localSettings[key];
    },

    get: function(key) {
        if ((typeof(key) === 'object') && key.length) {
            var result = {};
            for (var i=0; i<key.length; i++) {
                result[key[i]] = this.getOne(key[i]);
            }
            return result;
        }
        else {
            return this.getOne(key);
        }
    },

    set: function(key, value) {
        // It is redundant to supply 'local-' when setting a setting, but for consistency
        // we allow it.  Just remote the prefix.
        var regexLocal = /^local\-/;
        key = key.replace(regexLocal, '');

        var localSettings = IETAB.Storage.get('localSettings');
        if (!localSettings)
            localSettings = this._initLocal();

        localSettings[key] = value;
        IETAB.Storage.set('localSettings', localSettings);

        // Special-case for compat mode
        if (key == 'compat-mode')
            Background.onSetCompatMode(value);

        if (key == 'spellcheck')
            Background.onSetSpellCheck(value);

        if (key == 'scripturl-mitigation')
            Background.onSetScriptMitigation(value);

        if (key == 'open-in-new-tab')
            Background.onSetOpenInNewTab(value);

        if (key == 'autourl-list') {
            Background.onAutoUrlsChanged();
        }
    },

    init: function() {
        this._initLocal();
        this._updateSettings();

        var refreshInterval = this.get("settings-refresh-interval");
        window.setInterval((function() {
            this._updateSettings();
        }).bind(this), refreshInterval);
    }
}
