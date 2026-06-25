
(function($){$.fn.pbAjax=function(args){var widgetId=$(this).attr('widget-id');if(!widgetId){widgetId=$(this).data('widget-id');}
if(!widgetId){widgetId=$(this).attr('id');}
var pbContext=$("[name='pbContext']").attr('content');if((widgetId!==null)&&(widgetId!==undefined)){var data=args['data']?args['data']:{};data['pbContext']=pbContext;data['widgetId']=widgetId;var showJson=searchParams(window.location.href);if(showJson.hasOwnProperty("showJson"))
data["showJson"]=showJson["showJson"]||"";var targetUrl=args['url'];var requestMethod=args.hasOwnProperty('type')?args['type']:'GET';var requestDataType=args.hasOwnProperty('dataType')?args['dataType']:'html';var asyncRequest=args.hasOwnProperty('async')?args['async']:true;var successFunction=args['success'];var failFunction=args['error'];var beforeSend=args['beforeSend'];var complete=args['complete'];if(window.PB&&window.PB.$&&window.PB.$.pbRevisionId){data["pbSessionEm"]=true;data["pbEdit"]=true;data["pbDesign"]=true;data["pbSessionToken"]=window.PB.$.pbSessionToken();data["pbBaseRevision"]=window.PB.$.pbRevisionId();data["pbPendingChanges"]=window.PB.$.pbPendingChangesStr();data["filter"]=window.PB.$.pbFilters();data["pbLocale"]=window.PB.$.pbLocale();}
return $.ajax({type:requestMethod,dataType:requestDataType,async:asyncRequest,url:targetUrl,data:data,success:successFunction,error:failFunction,beforeSend:beforeSend,complete:complete});}else{console.log("widgetId not found");}
function searchParams(url){var objURL={};url.replace(new RegExp("([^?=&]+)(=([^&]*))?","g"),function($0,$1,$2,$3){objURL[$1]=$3;});return objURL;}};})(jQuery);

var literatum = {};

literatum.events = (function() {
    var instance = {};
    var listenersMap = {};

    instance.register = function(eventName, callback) {
        var listeners = listenersMap[eventName];
        if (!listeners) {
            listenersMap[eventName] = listeners = [];
        }
        listeners.push(callback);
    };

    instance.deregisterAll = function() {
        listenersMap = {};
    };

    instance.notify = function(eventName, data) {
        //console.log("Event '" + eventName + "' triggered.")
        var listeners = listenersMap[eventName];
        if (listeners) {
            listeners.forEach(function(listener) {
                listener(data);
            });
        }
    };

    return instance;
}());

literatum.Widget = function(widgetDef, element) {
    this.state = -1;
    this.$element = $(element);
    this.widgetDef = widgetDef;
    if (widgetDef) {
        this.registerListeners();
    }
};

literatum.Widget.prototype.get = function() {
    return this.$element;
};

literatum.Widget.prototype.resize = function(e) {};

literatum.Widget.prototype.render = function(model, params, callback, renderer) {
    if (this.widgetDef.action) {
        return literatum.widgets.getWidget(this, model, params, callback, renderer);
    }
};

literatum.Widget.prototype.lostFocus = function() {
    // nothing
};

literatum.Widget.prototype.updateView = function(view, model) {
    var $this = this.get();
    var $html = $(view.trim());
    if ($html.length > 0) {
        $this.replaceWith($html);
        this.$element = $("*[widget-id='" + $html.attr('widget-id') + "']");
        if (this.$element.length === 0 && $html.attr('id')) {
            this.$element = $("#" + $html.attr('id'));
        }
        if (this.$element.length === 0) {
            this.$element = $("*[data-widget-id='" + $html.attr('data-widget-id') + "']");
        }
    } else {
        this.$element.html("");
    }
    this.registerListeners();
    this.triggerInfoHandlers(this, model);
};

literatum.Widget.prototype.triggerInfoHandlers = function(widget, model) {
    var infoHandlers = widget.widgetDef.infoHandlers;
    if (model && model.attributes && infoHandlers) {
        Object.keys(model.attributes).forEach(function(key) {
            var infoHandler = infoHandlers[key];
            if (infoHandler) {
                infoHandler(model.attributes[key], widget, model);
            }
        });
    }
};

literatum.Widget.prototype.registerListeners = function() {
    try {
        this.unbind();
    } catch(e) {
        console.log(e);
    }
    try {
        //console.log("Binding events to candidate elements");
        this.bind();
    } catch (e) {
        console.log("Failed to bind events, rolling back...");
        this.unbind();
    }
};

literatum.Widget.prototype.update = function(model) {
    var result;
    console.log("Updating " + this.widgetDef.id + "...");
    if (!literatum.utils.hasErrors(model.attributes)) {
        result = this.render(model, {});
        console.log("Updating " + this.widgetDef.id + "... Content");
    } else {
        this.triggerInfoHandlers(this, model);
        this.loaded();
        console.log("Updating " + this.widgetDef.id + "... Info");
        result = $.Deferred().resolve();
    }
    return result;
};

literatum.Widget.prototype.bind = function() {
    var thisWidget = this;
    if (!thisWidget.widgetDef.binders)
        return;
    this.find("*[data-bind]").each(function() {
        var binderName = $(this).data("bind");
        var binder = thisWidget.widgetDef.binders[binderName];
        if (binder) {
            $(this).on('click keypress', function(e) {
                if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') {
                    binder.call(this, e, thisWidget);
                }
            });
        }
    });
    this.find("*[data-bind-change]").each(function() {
        var binderName = $(this).data("bind-change");
        var binder = thisWidget.widgetDef.binders[binderName];
        if (binder) {
            $(this).on('change', function(e) {
                literatum.events.notify('user-action');
                binder.call(this, e, thisWidget);
            });
        }
    });
};

literatum.Widget.prototype.unbind = function() {
    this.find("*[data-bind]").each(function() {
        $(this).off();
    });
};

literatum.Widget.prototype.find = function(selector) {
    return this.get().find(selector);
};

literatum.Widget.prototype.collectForms = function() {
    var $elements = this.find("form");
    var forms = {};
    $elements.each(function() {
        var $this = $(this);
        var name = $(this).attr('name');
        if (name) {
            var form = {};
            forms[name] = form;
            $this.find("input[type!='checkbox'], textarea").each(function() {
                form[$(this).attr('name')] = $(this).val();
            });

            $this.find("input[type='checkbox']").each(function() {
                if ($(this).is(":checked")) {
                    form[$(this).attr('name')] = $(this).val();
                }
            });

            $this.find("select").each(function() {
                form[$(this).attr('name')] =  $(this).find('option:selected').val();
            });
        }
    });
    this.find("*[data-form]").each(function() {
        var name = $(this).data('form');
        if (name) {
            var form = {};
            forms[name] = form;
            $(this).find("*[data-field]").each(function() {
                var $this = $(this);
                var value = $this.data('value');
                if (!value) {
                    value = $this.text().trim();
                }
                form[$this.data('field')] = value;
            });
        }
    });
    return forms;
};

literatum.Widget.prototype.updateForm = function(formName, sourceForm, merge) {
    var forms = this.find("form[name='" + formName + "']");
    if (forms) {
        var form = forms[0];
        if (form) {
            var $form = $(form);
            $form.find("input").each(function() {
                var $this = $(this);
                if ($this.attr("type") == 'submit') {
                    return;
                }

                var value = sourceForm[$this.attr('name')];
                if (merge && !value)
                    return;

                $this.val(value);
            });

            var $select = $form.find("select");
            $select.each(function() {
                var $this = $(this);
                var value = sourceForm[$this.attr('name')];

                if (merge && !value)
                    return;

                if (value) {
                    $this.closest(".input-group").show();
                }

                $this.find('option').prop('selected', false);
                $this.find("option[value='" + value + "']").prop('selected',true);
            });
        }
    }
};

literatum.Widget.prototype.initialize = function() {
    this.registerListeners();
};

literatum.Widget.prototype.loading = function() {
    $("body").addClass("widget-loading");
};

literatum.Widget.prototype.error = function() {
    //$("body").addClass("widget-error");
};

literatum.Widget.prototype.loaded = function() {
    //$("body").removeClass("widget-loading");
};

literatum.Widget.prototype.reset = function() {
    this.getNotifications().forEach(function(item) {
        item.reset();
    });
};

literatum.Widget.prototype.getNotifications = function() {
    var result = [];
    this.find("*[data-notification]").each(function() {
        if (this.literatumNotification) {
            result.push(this.literatumNotification);
        }
    });
    return result;
};

literatum.Widget.prototype.getNotification = function(name) {
    if (!this.widgetDef.notifications)
        return null;

    var thisWidget = this;

    var notification = null;

    this.find("*[data-notification='" + name + "']").each(function() {
        var notificationType = thisWidget.widgetDef.notifications[name];
        if (!this.literatumNotification) {
            this.literatumNotification = new notificationType(this);
        }
        notification = this.literatumNotification;
    });

    return notification;
};

literatum.Widget.prototype.register = function(service) {
    var thisWidget = this;
    commerce.cart.register(service, function(model) {
        return thisWidget.update(model);
    });
};

literatum.widgets = (function() {
    var instance = {};
    var widgetDefs = [];
    var widgets = [];

    // Environment-aware logging
    var debugLog = function(message) {
        var hostname = window.location.hostname;
        var isProduction = !hostname.includes('stag') &&
            !hostname.includes('test') &&
            !hostname.includes('localhost');
        if (!isProduction) {
            console.log(message);
        }
    };

    function render(template, model) {
        Object.keys(model).forEach(function(key) {
            var re = new RegExp('\\{{' + key + '\\}}', 'g');
            template = template.replace(re, model[key]);
        });
        template = template.replace(/{{.+?}}/g,'');
        return template;
    }

    $(window).on('resize', function(e) {
        widgets.forEach(function(widget) {
            widget.resize(e);
        });
    });

    instance.render = function(widget, model, params, callback, renderer) { // FIXME: clean me
        return widget.render(model, params, callback, renderer);
    };

    instance.getWidget = function(widget, model, params, callback, renderer) {
        return widget.get().pbAjax({
            type: 'GET',
            url: widget.widgetDef.action,
            dataType: 'html',
            data: params,
            async: true,
            success: function(html) {
                var result = render(html, model);
                if (renderer) {
                    renderer(html, model);
                } else {
                    widget.updateView(result, model);
                }
                //widget.get().fadeIn(400).fadeOut(400).fadeIn(400).fadeOut(400).fadeIn(400); // For debugging
                widget.loaded(); // This is not needed, confirm and remove
                if (callback) {
                    callback();
                }
                literatum.events.notify('widget-rendered');
            },
            error: function(data) {
                widget.error();
            }
        });
    };

    instance.get = function(id) {
        var result = [];
        widgets.forEach(function(item){
            if (item.widgetDef.id == id)
                result.push(item);
        });
        return result;
    };
    //instance.find = function(widgetId) {
    //    var $result = $("*[widget-def='" + widgetId +"']");
    //    if ($result.length > 0) {
    //        return $result;
    //    }
    //    return $("." + widgetId);
    //};
    instance.all = function() {
        return widgets.slice(0);
    };

    instance.collapse = function() {
        widgets.forEach(function(widget) {
            widget.hide();
        });
    };

    instance.register = function(widgetDef) {
        widgetDefs.push(widgetDef);
    };

    instance.initialize = function() {
        widgetDefs.forEach(function(WidgetDef) {
            WidgetDef.find().each(function() {
                var instance = Object.create(WidgetDef.prototype);
                WidgetDef.call(instance, WidgetDef, this);
                widgets.push(instance);
            });
        });
    };

    // Public method to expose debugLog if needed
    instance.debugLog = debugLog;

    return instance;
}());

$(function() {
    literatum.widgets.initialize();
    literatum.widgets.debugLog("Widgets initialized!");
});

literatum.Loading = function(deferred) {
    this.start();
    this.deferred = deferred;
    $.when(deferred).then(this.done);
};

literatum.Loading.prototype.start = function() {};

literatum.Loading.prototype.done = function() {};

literatum.FullPageLoading = function(fadingTime) {
    this.message = '';
    this.fadingTime = fadingTime || 200;
};

literatum.FullPageLoading.prototype = new literatum.Loading();

literatum.FullPageLoading.prototype.start = function() {
    $("body").append('<div class="loading-overlay"><div class="loading-container"><div class="loading"></div><div class="loading-message">' + this.message + '</div></div></div></div>');
    var isIOS = navigator.userAgent.match(/ipad|ipod|iphone/i);
    if(!isIOS) {
        $(".loading-overlay").fadeIn(this.fadingTime);
    }else{
        $(".loading-overlay").show();
    }
    return this;
};

literatum.FullPageLoading.prototype.done = function() {
    var $overlay = $(".loading-overlay");
    var isIOS = navigator.userAgent.match(/ipad|ipod|iphone/i);
    if(!isIOS){
        $overlay.fadeOut(this.fadingTime, function () {
            $overlay.remove();
        });
    }else{
        $overlay.hide().remove();
    }
};

literatum.FullPageLoading.prototype.setMessage = function(message) {
    this.message = message;
};

/* (c) Atypon
 This provides support for search related widgets */
(function ($) {
    var desktopWidth = 992;
    $(function() {

    if ($(window).width() > desktopWidth) {
        $('.fancy-tooltip').tooltip({
            show: {
                effect: "fadeIn",
                delay: 250
            }
        });
    }
    $('.citationSearchBoxContainer input').each(function(index,input){
        $(input).attr('disabled','disabled')
    });

    $('.quickSearchForm').on("submit",function(e){
        var submit;
        ($('.quickSearchForm input[type=search]')).each(function(index,input){
            if($(input).attr('disabled') != 'disabled' &&  $(input).val() != ''){
                submit = true;
                return false;
            }
        });
        ($('.quickSearchForm input[type=text]')).each(function(index,input){
            if($(input).attr('disabled') != 'disabled' &&  $(input).val() != ''){
                submit = true;
                return false;
            }
        });
        if(submit){
            return true;
        }
        window.location = '/search/advanced';
        return false;

    });

    quickSearch.initAutoComplete();

    $(".js__searchInSelector").on('change',quickSearch.quickSearchSelectionHandler);

});

quickSearch = function(){

    function _citationSearchMode($dropdown) {
        var container = $dropdown.closest("form");
        container.find('.simpleSearchHelp').hide();
        container.find('.simpleSearchBoxContainer').hide();
        _disableInputs(container.find('.simpleSearchBoxContainer'));
        _enableInputs(container.find('.citationSearchBoxContainer'));
        container.find(".citationSearchBoxContainer").find("input[name='quickLinkYear']").attr("disabled", true);
        container.find(".citationSearchBoxContainer").find("input[name='quickLinkVolume']").attr("disabled", true);
        container.find(".citationSearchBoxContainer").find("input[name='quickLinkPage']").attr("disabled", true);
        if(container.find(".citationSearchBoxContainer").find("input[name='quickLinkIssue']").attr("type")!="hidden"){
            container.find(".citationSearchBoxContainer").find("input[name='quickLinkIssue']").attr("disabled", true);
        }
        if ($('.quickSearchFormContainer input[name="quickLinkJournal"]').val()!="") {
            $(".quickSearchFormContainer .mainSearchButton").prop("disabled", false);
        }
        else {
            $(".quickSearchFormContainer .mainSearchButton").attr('disabled', true);
        }
        setupCitationSubmitButton('quickSearchFormContainer');
        container.find('.citationHelp').show();
        container.find('.citationSearchBoxContainer').show();
        container.attr('action','/action/quickLink');
    };

    function _simpleSearchMode($dropdown){
        var container = $dropdown.closest("form");
        container.find('.citationHelp').hide();
        container.find('.citationSearchBoxContainer').hide();
        _disableInputs(container.find('.citationSearchBoxContainer'));
        _enableInputs(container.find('.simpleSearchBoxContainer'));
        container.find('.simpleSearchBoxContainer').show();
        container.find('.simpleSearchHelp').show();
        container.attr('action','/action/doSearch');
        container.find("input[type='hidden'][name='SeriesKey']").attr('disabled',true);
        $(".quickSearchFormContainer .mainSearchButton").prop("disabled", false);
    };

    function _disableInputs($selector){
        $selector.find('input').each(function(index,input){
            $(input).attr('disabled','disabled')
        });
    };

    function _enableInputs($selector){
        $selector.find('input').each(function(index,input){
            $(input).prop("disabled", false);
        });
    };
    function setupCitationSubmitButton(container) {

        $('.quickSearchFormContainer input[name="quickLinkJournal"]').on('keyup', function () {
            if ($('.quickSearchFormContainer  input[name="quickLinkJournal"]').val() == '') {
                $(".quickSearchFormContainer .mainSearchButton").attr('disabled', true);
            }
            else {
                $(".quickSearchFormContainer .mainSearchButton").prop("disabled", false);
            }
        });

    };

    $.widget( "custom.catcomplete", $.ui.autocomplete, {
        _create: function() {
            this._super();
            this.widget().addClass('quickSearchAutocomplete');
            this.widget().menu( "option", "items", "> :not(.qsaCategory)" );
        },
        _renderMenu: function( ul, items ) {
            var fuzzySuggesterEnabled = $(this.element).data('fuzzy-suggester');
            var that = this;
            if(fuzzySuggesterEnabled){$(ul).addClass('newSuggester')}
            $.each(items, function (index, item) {
                if(fuzzySuggesterEnabled){
                    var catSelector = ".ui-autocomplete-category[data-category='" + item.category + "']";
                    if ($(catSelector).length < 1) {
                        if(item.category === 'Quick Links'){
                            ul.prepend("<li class='ui-autocomplete-category' data-category='" + item.category + "'>" + item.category + "</li>");
                        }else{
                            ul.append("<li class='ui-autocomplete-category' data-category='" + item.category + "'>" + item.category + "</li>");
                        }

                    }
                    var $item = that._renderItemData(ul, item);
                    $(ul).children(catSelector).after($item);
                }else{
                    var $item = that._renderItemData(ul, item);
                    $(ul).append($item);
                }

            });
            if($('.ui-autocomplete-category').length < 2){
                $('.ui-autocomplete-category').remove();
            }
        },
        _renderItem:function (ul, item) {
            var fuzzySuggesterEnabled = $(this.element).data('fuzzy-suggester');

            var $aWrap = $('<a>').addClass("qsaHistoryItem");
            if (item.history){
                var itemSpan = $.parseHTML(item.highlight);
                var removeDiv = $('<a>').attr('href','#').addClass("qsaRemove").html('[Remove]');
                removeDiv.bind('click', function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    var selectedHistoryItem = $(e.target.parentNode.parentNode).data().qsaItem;
                    var autoCompeteSearchUri = ['/action/doDeleteHistory?ajax=true&uri=', encodeURIComponent(selectedHistoryItem.value)].join('');
                    $.ajax(autoCompeteSearchUri).done(function(result) {
                        if (result === 'true') {
                            e.target.parentNode.remove();
                        }
                    });
                });
                $aWrap.append(removeDiv);
                $aWrap.append(itemSpan);
            }else{
                $aWrap.html(item.highlight).attr('title',item.label);
            }
            var $elm = $("<li>").data("qsaItem", item).data("item-param", item.param).append($aWrap).addClass('qsaItem');
            if (item.category && fuzzySuggesterEnabled) {
                $elm.attr("aria-label", item.category + " : " + item.label);
                $elm.attr("data-category", item.category);
            }
            return $elm;

        },
        _resizeMenu: function() {
            var ul = this.menu.element;

            if (this.element.outerWidth() < 250) {
                ul.outerWidth(this.element.outerWidth() + 40 / 100 * this.element.outerWidth());
            }else{
                ul.outerWidth(this.element.outerWidth());
            }
        }
    });

    return {

        initAutoComplete: function (dropOption) {

            var that = this;

            $('.quickSearchFormContainer .autocomplete').catcomplete({
                source: function (request, response) {
                    var enteredTerm = request.term;
                    var $inputElem = $(this.element);

                    var maxWords = $inputElem.data("auto-complete-max-words");
                    var maxChars = $inputElem.data("auto-complete-max-chars");
                    if(enteredTerm.split(" ").length > maxWords || enteredTerm.length > maxChars || !enteredTerm.replace(/\s/g, '').length){
                        return false;
                    }
                    var selectedOption = $('.js__searchInSelector option:selected').val();

                    var autoCompleteSearchType = '';

                    if (selectedOption === 'Title' ||  selectedOption =='citation') {
                        autoCompleteSearchType = 'title-';
                    } else if (selectedOption === 'Contrib') {
                        autoCompleteSearchType = 'contrib-';
                    }
                    var isDisabled = disableAutoCompleteIfAllSetToZero($inputElem);

                    if(isDisabled === 'false') {
                        sendAjaxRequest($inputElem, dropOption, enteredTerm, autoCompleteSearchType, selectedOption, response);
                    }

                },
                //To prevent showing value when user is using up/down arrow key
                focus: function (event, ui) {
                    return false;
                },
                //autoFocus:true,
                select: function (event, ui) {
                    if($(event.target).attr('name') != 'quickLinkJournal'){
                        $(event.target).val(ui.item.label);
                        window.location.href = ui.item.value;
                    }else{
                        $(event.target).val(ui.item.label);
                    }
                    return false;
                }
            }).on('click', function (e) {
                    $(this).catcomplete({minLength: 2});
                }
            )
        },
        quickSearchSelectionHandler: function () {

            var selectedValue = $("option:selected", this).data('search-in')
                , $searchInSelector = $('.js__searchInSelector');
            //if selected value = journals,books
            if (selectedValue == 'journal' || selectedValue == 'book') {
                _simpleSearchMode($(this));
                $($searchInSelector).attr('name', 'pubType');
                $('#searchText').attr('name', 'AllField');
            }
            //else if selected value = all, author
            else if (selectedValue == 'AllField' || selectedValue == 'Contrib') {
                _simpleSearchMode($(this));
                $($searchInSelector).attr('name', 'field1');
                $('#searchText').attr('name', 'text1');
            }

            else if (selectedValue == 'citation') {
                _citationSearchMode($(this));
            }
            else if (selectedValue == 'thisIssue') {
                _simpleSearchMode($(this));
                $('.searchText').attr('name', 'AllField');
                $($searchInSelector).attr('name', 'Issue');
                $('.quickSearchForm').find("input[type='hidden'][name='SeriesKey']").prop('disabled',false);

            }
            else
            if (selectedValue == 'thisJournal' || selectedValue == "thisSeries") {
                _simpleSearchMode($(this));
                $($searchInSelector).attr('name', 'SeriesKey');
                $('.searchText').attr('name', 'AllField');
            }
            else{
                _simpleSearchMode($(this));
                if (selectedValue == "default"){
                    $($searchInSelector).attr('name', '');
                }
                else {
                    $($searchInSelector).attr('name', 'publication');
                }
                $('.searchText').attr('name', 'AllField');

            }
        }
    };
}();

function disableAutoCompleteIfAllSetToZero($inputSearchText){
    var confNumOfHistoryItems = $inputSearchText.data('historyItemsConf');
    var confNumOfPublicationTitles = $inputSearchText.data('publication-titles-conf');
    var confNumOfGroupItems= $inputSearchText.data('group-titles-conf');
    var confNumOfPublicationItems = $inputSearchText.data('publication-items-conf');
    var confNumOfTopics = $inputSearchText.data('topics-conf');
    var confNumOfContributors = $inputSearchText.data('contributors-conf');
    if(confNumOfHistoryItems == 0 && confNumOfGroupItems == 0 && confNumOfPublicationTitles == 0 && confNumOfTopics == 0 && confNumOfContributors == 0 && confNumOfPublicationItems == 0)
        return 'true';
    return 'false';
}

function sendAjaxRequest($inputSearchText,dropOption,enteredTerm ,autoCompleteSearchType,selectedOption ,response){
    var results = [];
    var confNumOfHistoryItems = $inputSearchText.data('history-items-conf');
    var confNumOfPublicationTitles = $inputSearchText.data('publication-titles-conf');
    var confNumOfGroupItems= $inputSearchText.data('group-titles-conf');
    var confNumOfPublicationItems = $inputSearchText.data('publication-items-conf');
    var confNumOfTopics = $inputSearchText.data('topics-conf');
    var confNumOfContributors = $inputSearchText.data('contributors-conf');
    var fuzzySuggesterEnabled = $inputSearchText.data('fuzzy-suggester');
    var displayLabels = $inputSearchText.data('display-labels');

    if (dropOption === 'citation'){ //quick fix for LIT-138406
        var autoCompeteSearchUrl = ['/action/doSuggest?target=title-auto-complete&query=', enteredTerm,
            '&pts=', confNumOfPublicationTitles, '&fl=PubID'].join('');
    }else{
        var autoCompeteSearchUrl = ['/action/doSuggest?target=', autoCompleteSearchType, 'auto-complete&query=', enteredTerm,
            '&hs=', confNumOfHistoryItems, '&pts=', confNumOfPublicationTitles, '&ptgs=' , confNumOfGroupItems , '&ptfs=', confNumOfPublicationItems , '&ts=', confNumOfTopics,
            '&cs=', confNumOfContributors, '&fl=PubID'].join('');
    }
    $.getJSON(autoCompeteSearchUrl)
        .done(function (resultData) {

            var numOfTitles, NumOfGroupItems, numOfItems, numOfTopics, numOfContrib, numOfHistory;
            numOfTitles = NumOfGroupItems = numOfItems = numOfTopics = numOfContrib = numOfHistory = 0;

            var getSuggestion = function(item){
                var suggestion = {
                    'label' : item.label,
                    'highlight' : item.highlight,
                    'category': item.param == 'DOI' ? 'Quick Links' : 'Suggested Search',
                    'param': item.param,
                    'history' : false
                };
                if (item.param === 'history') {
                    suggestion['value'] = decodeURI(item.value);
                    suggestion['history'] = true;
                }else if(selectedOption =='citation'){
                    suggestion['value'] = item.value;
                }
                else{
                    suggestion['value'] =  item.url;
                }


                if(fuzzySuggesterEnabled &&
                    displayLabels){
                        suggestion['highlight'] += '<span class="pull-right suggestionType">' + item.paramFormatted + '</span>';
                }

                return suggestion;
            };

            $.each(resultData, function (i, item) {
                if ( (item.param === 'history') && (numOfHistory < confNumOfHistoryItems) ) {
                    results.push(getSuggestion(item));
                    numOfHistory++;
                } else if ( (item.param === 'SeriesKey') && (numOfTitles < confNumOfPublicationTitles) ) {
                    results.push(getSuggestion(item));
                    numOfTitles++;
                } else if ( (item.param === 'DOI') && (numOfItems < confNumOfPublicationItems) ) {
                    results.push(getSuggestion(item));
                    numOfItems++;
                } else if ( (item.param === 'ContentGroupKey') && (NumOfGroupItems < confNumOfGroupItems) ) {
                    results.push(getSuggestion(item));
                    NumOfGroupItems++;
                } else if ( (item.param === 'ConceptID') && (numOfTopics < confNumOfTopics) ) {
                    results.push(getSuggestion(item));
                    numOfTopics++;
                } else if ( (item.param === 'ContribRaw') && (numOfContrib < confNumOfContributors) ) {
                    results.push(getSuggestion(item));
                    numOfContrib++;
                }
            });
            response(results);
        }).fail(function () {
        console.log('failed');
    });
}
})(jQuery);


function loadRecaptcha(){if(typeof grecaptcha=='undefined')
return;$('.g-recaptcha').filter(function(){return!$(this).hasClass('explicit');}).each(function(){grecaptcha.render($(this)[0],$(this).data());});$(".g-recaptcha iframe").attr("title","reCaptcha");}
function clearCapcha(){if(typeof grecaptcha!='undefined')
grecaptcha.reset(0);}
function captchaChallengeSubmit(response){$('textarea#g-recaptcha-response').each(function(){if($(this).val()===response){$(this).closest('form').submit();}});}
function validateHoldingsForm(e){$('.holdings-messages').empty();if($('#list[type=radio]:checked').length>0){var value=$('#emailList').val();var emailCollection=value.split(";");for(var i=0;i<emailCollection.length;i++){if(showErrorIfInvalid(emailCollection[i].trim(),e)===false){break;}}}}
function showErrorIfInvalid(email,e){var isValid=validateEmail(email);if(!isValid){if($('#error-message').length==0){var error='<p id="error-message" class="warning-msg">You have entered an invalid email address!</p>';$('#emailList').parent().append(error);}
e.preventDefault();e.stopPropagation();return false;}
return true;}
function validateEmail(email){var re=/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;return re.test(String(email).toLowerCase());}
$(function(){$("#emailList").bind("input",function(){if($('#emailList').val()!==""){$('#list').prop('checked','true');}});});$(function(){$('pre.show-json').each(function(){var $jsonElement=$(this);$jsonElement.parent().addClass('widget-container');var widgetType=getWidgetType($jsonElement);var widgetId=getWidgetId($jsonElement);$(this).parent().prepend('<button type="button" data-toggle="modal" data-target="#requested-widget-json" class="btn show-json-btn" data-widget-id="'+widgetId+'" title="show json of '+widgetType+'">{.,.}</button>');});$('.show-json-btn').click(function openShowJsonDialog(){var $jsonElements=$(this).parent().find('>.show-json');if($jsonElements.length>1){$jsonElements=getJsonElementOfWidget($jsonElements,$(this).data('widgetId'));}
var jsonString=$jsonElements[0].innerHTML;var widgetType=getWidgetType($jsonElements);renderJsonViewer(JSON.parse(jsonString));$('.show-json-container .modal__header h2').html('Json for '+widgetType);});$('.show-json-container .btn-collapse').click(function(e){var $buttonIcon=$(this).find('#collapsed');if($buttonIcon.hasClass('node-collapsed'))
$buttonIcon.removeClass('node-collapsed icon-plus-light').addClass('node-opened icon-minus-light');else $buttonIcon.removeClass('node-opened icon-minus-light').addClass('node-collapsed icon-plus-light');renderJsonViewer()});$('.show-json-container .btn-copy').click(function(e){var json=$('.show-json-container').data('json');copyStringToClipboard(JSON.stringify(json));});$('.show-json-container .btn-word-wrap').click(function(e){$('.show-json-container .json-string').toggleClass('word-wrap-toggle');});$('.btn-fullscreen').click(toggleFullscreen);function toggleFullscreen(event){var element=document.querySelector("#json-renderer-container");if(event instanceof HTMLElement){element=event;}
var isFullscreen=document.webkitIsFullScreen||document.mozFullScreen||false;element.requestFullScreen=element.requestFullScreen||element.webkitRequestFullScreen||element.mozRequestFullScreen||function(){return false;};document.cancelFullScreen=document.cancelFullScreen||document.webkitCancelFullScreen||document.mozCancelFullScreen||function(){return false;};isFullscreen?document.cancelFullScreen():element.requestFullScreen();}
function copyStringToClipboard(str){var el=document.createElement('textarea');el.value=str;el.setAttribute('readonly','');el.style={position:'absolute',left:'-9999px'};document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);}
function renderJsonViewer(json){if(json)
$('.show-json-container').data('json',json);else json=$('.show-json-container').data('json');var options={collapsed:$('.show-json-container #collapsed.node-collapsed').length==1};$('.show-json-container .modal__body #json-renderer').jsonViewer(json,options);}
function getWidgetType($jsonEl){var widgetType=$jsonEl.parent().attr('data-widget-def');if(!widgetType){var thisWidget=JSON.parse($($jsonEl).text()).thisWidget;if(thisWidget){widgetType=JSON.parse($($jsonEl).text()).thisWidget.widgetName;}}
return widgetType;}
function getWidgetId($jsonEl){var widgetId=$jsonEl.parent().attr('data-widget-id');if(!widgetId){var thisWidget=JSON.parse($($jsonEl).text()).thisWidget;if(thisWidget){widgetId=thisWidget.id;}}
return widgetId;}
function getJsonElementOfWidget($jsonElement,widgetId){var requestedJsonEl;$jsonElement.each(function(index){if((JSON.parse($(this).text()).thisWidget.id==widgetId)){requestedJsonEl=$(this);return false;}});return requestedJsonEl;}});


var Track={};(function(undefined){var jquery=typeof jQuery!='undefined';var elements={};var userAgent=navigator.userAgent.toLowerCase();var defaultAjaxSettings={async:!/webkit/.test(userAgent),asynchronous:!/webkit/.test(userAgent),cache:false,timeout:/msie/.test(userAgent)?0:100,requestTimeout:/msie/.test(userAgent)?0:100,contentType:'application/x-www-form-urlencoded',url:'/action/clickThrough'};var extend=function(dst,src){if(jquery){extend=jQuery.extend;}else{extend=Object.extend;}
return extend(dst,src);};var each=function(o,iterator){if(jquery){each=jQuery.each;}else{each=function(object,callback){var name,i=0,length=object.length,isObj=length===undefined||typeof object==="function";if(isObj){for(name in object){if(callback.call(object[name],name,object[name])===false){break;}}}else{for(var value=object[0];i<length&&callback.call(value,i,value)!==false;value=object[++i]){}}
return object;};}
return each(o,iterator);};var bind=function(selector,options,callback){var jQueryBind=function(selector,options,callback){if(options.selector){jQuery(selector).on(options.on,options.selector,options,callback);}else{jQuery(selector).on(options.on,options,callback);}};var oldJQueryBind=function(selector,options,callback){var callbackToUse=callback;if(options.selector){callbackToUse=function(event){var $target=$(event.currentTarget);while(!$target.is(options.selector)&&$target.children().length){$target.children().each(function(){$target=$(this);if($target.is(options.selector)){return false;}});}
if($target.is(options.selector)){callback.call(event.target,event,options);}};jQuery(selector).data('TrackCallback',callbackToUse);}
jQuery(selector).bind(options.on,options,callbackToUse);};var prototypeBind=function(selector,options,callback){$$(selector).each(function(el){Event.observe(el,options.on,callback.bindAsEventListener(this,options));});};if(jquery){if(jQuery.fn.on){bind=jQueryBind;}else{bind=oldJQueryBind;}}else{bind=prototypeBind;}
return bind(selector,options,callback);};var unbind=function(selector,options,callback){var jQueryUnbind=function(selector,options,callback){if(options.selector){jQuery(selector).off(options.on,options.selector,options,callback);}else{jQuery(selector).off(options.on,options,callback);}};var oldJQueryUnbind=function(selector,options,callback){if(options.selector){callback=jQuery(selector).data('TrackCallback');}
if(callback){jQuery(selector).unbind(options.on,callback);}else{jQuery(selector).unbind(options.on);}};var prototypeUnbind=function(selector,options,callback){$$(selector).each(function(el){Event.stopObserving(el,options.on);});};if(jquery){if(jQuery.fn.on){unbind=jQueryUnbind;}else{unbind=oldJQueryUnbind;}}else{unbind=prototypeUnbind;}
return unbind(selector,options,callback);};var sendBeacon=function(options){var formData=new FormData();for(var key in options.data){if(options.data.hasOwnProperty(key)){formData.append(key,options.data[key]);}}
navigator.sendBeacon(options.url,formData);};var ajax=function(ajaxOptions){var isSafari=(new RegExp("apple","i")).test(navigator.vendor);var useBeacon=ajaxOptions.useBeacon&&navigator.sendBeacon&&!isSafari;if(useBeacon){ajax=sendBeacon;}else if(jquery){ajax=jQuery.ajax;}else{ajax=function(options){options.parameters=options.data;new Ajax.Request(options.url,options);}}
ajax(ajaxOptions);};var defaultFire=function(options,data){var ajaxSettings=extend(extend({},defaultAjaxSettings),options.ajaxSettings);ajaxSettings.data=extend(extend({},ajaxSettings.data),data);ajax(ajaxSettings);};var defaultOptions={on:'mouseup',fire:defaultFire,acceptEvent:function(e){return e.which===1||e.which===2;},data:{}};var methods={setup:function(options){if(options.fire!==undefined){defaultFire=options.fire;}
if(options.options!==undefined){defaultOptions=extend(extend({},defaultOptions),options.options);}
if(options.ajax!==undefined){defaultAjaxSettings=extend(extend({},defaultAjaxSettings),options.ajax);}},init:function(el){each(elements=el,function(selector,options){if(Object.prototype.toString.call(options)==='[object Array]'){var array=options;for(var i=0;i<array.length;++i){options=array[i];options=extend(extend({},defaultOptions),options);if(options.fire!==undefined){bind(selector,options,methods.onEvent);}}}else{options=extend(extend({},defaultOptions),options);if(options.fire!==undefined){bind(selector,options,methods.onEvent);}}});return this;},destroy:function(){elements.each(function(selector,options){unbind(selector,options.on,options.fire);});return this;},onEvent:function(event,options){if(options==undefined){options=event.data;}
var data=options.data;if(typeof options.acceptEvent=='function'&&!options.acceptEvent(event)){return true;}
var addData=options.addData;if(typeof addData=='function'){try{extend(data,addData.call(event.target,options,event));}catch(ex){if(console&&console.log){console.log('Failed to extract data:'+ex);return;}}}
options.fire(options,data);return true;}};Track=function(method){if(methods[method]){return methods[method].apply(this,Array.prototype.slice.call(arguments,1));}else if(typeof method==='object'||!method){return methods.init.apply(this,arguments);}};})();


(function(){window.TrackPageTransitions=function(Track,$,o){o=o||{};var $elements=$('*[data-track]');if(!$elements.length){return;}
Track('setup',{ajax:{url:o.url||'/action/analytics',method:'POST',useBeacon:true}});var captureAllPageTransitions=$('html[data-track]').length!=0;Track({body:[{on:'mousedown keydown',selector:captureAllPageTransitions?'a[href]':'*[data-track] a[href], a[href][data-track]',addData:extractData,acceptEvent:function(e){return e.which==1||e.keyCode==13;},data:{EventType:'PageTransition'}},{on:'submit',selector:captureAllPageTransitions?'form':'*[data-track] form, form[data-track]',addData:extractData,data:{EventType:'PageTransition'}}]});};if(typeof Track!='undefined'){if(typeof jQuery!='undefined'){$(function(){TrackPageTransitions(Track,jQuery);});}else if(typeof window.Prototype!='undefined'){document.observe('dom:loaded',function(){TrackPageTransitions(Track,$$);});}}
function collectData(el){var d={};$.each(el.attributes,function(i,attrib){var name=attrib.name;if(name.indexOf('data-')==0){name=name.substring("data-".length);name=name.replace(/-([a-z])/g,function(g){return g[1].toUpperCase();});d[name]=attrib.value;}});return d;}
function extractData(options,event){var data={};var $html=$(document.documentElement);var requestId=$html.data('requestId');if(requestId){data.OriginRequestId=requestId;data.OriginUrl=window.location.href;var date=new Date();date.setTime(date.getTime()+60*1000);var expires=date.toGMTString();document.cookie='OriginRequestId='+requestId+'; expires='+expires+"; path=/";}
var $this=$(this);var href;var link=$this.closest("a")
if(link.length){data.LinkText=$this.text();href=link.attr('href');}else if($this.is("form")){href=$this.attr('action');}
if(href){data.LinkHref=href;if(href.indexOf('/doi/')!=-1){var doi=href.split("/doi/")[1];var doiPattern=new RegExp('^10\\.\\d\\d\\d\\d(\\d*)/(.+)');if(doiPattern.test(doi)){data.doi=doi;}else{data.doi=doi.substring(doi.indexOf('/')+1);}}}
var innerFound=false;$.each($this.add($this.parents()),function(){var $ancestor=$(this);var d=null;try{d=$ancestor.data();}catch(ex){d=false;}
if(d===false){d=collectData($ancestor.get(0));}
for(var property in d){if(d.hasOwnProperty(property)&&property.indexOf("track")==0){var name=property.substring("track".length);if(name=="Func"&&d[property]){var func=window[d[property]];if($.isFunction(func)){try{var extra=func.call($ancestor);if(extra){$.extend(data,extra);}}catch(ex){}}
continue;}
if(name.length){data['Track'+name]=d[property];}
if(!innerFound){innerFound=true;var link=$this.closest("a")
if(link.length){var linkIndex=$('a[href*="/doi"], a[href*="/loi"], a[href*="/toc"]',$ancestor).index(link);if(linkIndex>-1){data.LinkIndex=linkIndex+1;}}}}}});if(event.which==1){data.ClickPageX=event.pageX;data.ClickPageY=event.pageY;}
return data;}})();


(function(){var TrackSearchResults=function(Track,$,undefined){var $searchResults=$('.searchResultContainer, #frmSearchResults, #frmSearch, #searchResultsAll, #searchResults, .searchResult, .search-result, #searchResultContent, .os-search-results');if(!$searchResults.length){return;}
Track('setup',{ajax:{url:'/action/analytics',useBeacon:true}});var resultSelectorAction={selector:'a[href^="/doi"], a[href^="/article"]',addData:extractDataSearchResult,data:{EventType:'SearchResultClicked'}};Track({'.searchResultContainer .articleLinks, #frmSearch .articleEntry td, .searchResultsListing li':resultSelectorAction,'#searchResultsAll .articleEntry td, #searchResults .searchResultItem .articleInfo':resultSelectorAction,'#frmSearchResults .articleEntry td, #frmSearchResults .articleEntry div, #frmSearchResults .searchResultItem span':resultSelectorAction,'#frmSearchResults .searchResultItem .atcl-item, #frmSearchResults .searchResultItem div':resultSelectorAction,'#frmSearchResults .searchEntry .searchEntryTools, .searchResult .result-list li':resultSelectorAction,'.contentContainer .searchResult td, .search-result .items-results li span':resultSelectorAction,'#frmSearch .article-details, #frmSearchResults .search-results .search-result-item':resultSelectorAction,'#searchResultContent .o-results .m-result, #frmSearchResults .search-results .articleBox, .search-result .items-results .issue-item_metadata':resultSelectorAction,'.search-result .items-results .issue-item, .os-search-results .os-search-results_item':resultSelectorAction});};if(typeof Track!='undefined'){if(typeof jQuery!='undefined'){$(function(){TrackSearchResults(Track,jQuery);});}else if(typeof window.Prototype!='undefined'){document.observe('dom:loaded',function(){TrackSearchResults(Track,$$);});}}
function extractCommonData(data,options,event){var $this=$(this);var searchResultRows;var clickedRow;var $searchResultRow=$this.closest('#searchResultItems, .search-results, .searchEntry, .contentContainer, #frmSearch, #frmSearchResults, #searchResultContent .o-results, .search-result');if($searchResultRow.length){searchResultRows=$searchResultRow.find('.articleEntry, .searchResultItem, .searchEntry, .article-details, .search-result-item, .m-result, .articleBox, .issue-item');clickedRow=$this.closest('.articleEntry, .searchResultItem, .searchEntry, .article-details, .search-result-item, .m-result, .articleBox, .issue-item');}else{$searchResultRow=$this.closest('.searchResultsListing, .result-list, .items-results, .os-search-results_list ul');if($searchResultRow.length){searchResultRows=$searchResultRow.children('li');clickedRow=$this.closest('li');}}
if(searchResultRows.length&&clickedRow.length){data.searchPageRank=searchResultRows.index(clickedRow)+1;}
var $container=$this.closest('.searchResultContainer, .type-search-results, .searchNav, .searchResult, .search-result, #searchResultContent, .os-search-results');if(!$container.length){$container=$('.searchResults_paging, .searchResultsCont, .searchResults');}
if($container.length){var $selectedPage=$container.find('.pages .selected:first, .pages .activeLink:first, .pages .current:first, .searchPages .activeLink:first, .pagination .activeLink:first, .pagination .active:first, .pageLinks .selected:first, .paginationLinks .s-active:first, .pagination_pages .pagination_current');if($selectedPage.length&&isInt($selectedPage.text())){data.resultPageNum=parseInt($selectedPage.text());}else{var $paginationElements=$container.find('.paginationControls, .paginationLinks').first().find('li:not(:has(a))');if($paginationElements.length){$paginationElements.each(function(){var $innerMostChildOfPagination=$(this).children();while($innerMostChildOfPagination.length){$innerMostChildOfPagination=$innerMostChildOfPagination.children();}
$selectedPage=$.trim($innerMostChildOfPagination.end().text());if($selectedPage.length&&isInt($selectedPage)){data.resultPageNum=parseInt($selectedPage);return false;}});}}}
if(!data.resultPageNum){var startPageFromSearchForm=$('#searchResultsAll, #frmSearch, #frmSearchResults').find('input[name=startPage]');if(startPageFromSearchForm.length&&isInt(startPageFromSearchForm.val())){data.resultPageNum=parseInt(startPageFromSearchForm.val())+1;}}}
function isInt(n){return parseInt(n)+0===parseInt(n);}
function extractDataSearchResult(options,event){var data={};var $this=$(this);var $articleEntry=$this.closest('.articleEntry, .searchResultItem, .articleCitation, .m-result');if($articleEntry.length){data.doi=$articleEntry.find(':input[name="doi"]').val();if(!data.doi){data.pii=$articleEntry.find(':input[name="pii"]').val();}}
if(!data.doi&&!data.pii){var href=$this.attr('href');if(typeof href=='undefined'){var link=$this.closest('a');href=link.attr('href');}
if(href.includes("doi")){var doi=href.split("/doi/")[1];var doiPattern=new RegExp('^10\\.\\d\\d\\d\\d(\\d*)/(.+)');if(doiPattern.test(doi)){data.doi=doi;}else{data.doi=doi.substring(doi.indexOf('/')+1);}}else if(href.includes("article/")){var pii=href.split("/article/")[1];data.pii=pii.substring(0,pii.indexOf("/"));}}
extractCommonData.call(this,data,options,event);return data;}
function extractDataForPagination(options,event){var data={};var $this=$(this);var page=$this.text();if(page){data.SearchResultsPageClicked=page;}
extractCommonData(data,options,event);return data;}})();


(function(){async function fetchUserInfo(){try{const response=await fetch("/action/connectTeaserInfo",{method:'GET',credentials:'include',headers:{'Accept':'application/json',},});if(response.ok){const userInfo=await response.json();return userInfo;}else{console.error("Failed to fetch user info:",response.status,response.statusText);return null;}}catch(error){console.error("Error fetching user info:",error);return null;}}
window.addEventListener("message",async function(event){if(event.data==="requestHost"){event.source.postMessage({origin:window.location.origin,path:window.location.pathname},event.origin);}
if(event.data.iframeHasData===false){document.querySelector('.connect-teaser').style.display='none';}else if(event.data.iframeHasData===true){document.querySelector('.connect-teaser').style.display='block';}
if(event.data==="requestUserInfo"){const userInfo=await fetchUserInfo();if(userInfo){event.source.postMessage({userInfo},event.origin);}else{event.source.postMessage({error:"Failed to retrieve user info"},event.origin);}}
if(event.data?.type==="SET_TEASER_COOKIE"){document.cookie="connect_teaser_closed_session=true; path=/";}
if(event.data?.type==="CHECK_TEASER_COOKIE"){const cookieMatch=document.cookie.match(/connect_teaser_closed_session=(true|false)/)
const value=cookieMatch?cookieMatch[1]:"false"
event.source.postMessage({type:"REPLY_TEASER_COOKIE",value},event.origin)}});})();


var commerce={};commerce.page={};commerce.page.cart={};


literatum.utils={send:function(request,callback,error){if(!request)
return;request.ajaxRequest=true;return $.ajax({url:'/action/'+request.action,type:'POST',contentType:'application/x-www-form-urlencoded',crossDomain:true,xhrFields:{withCredentials:true},data:request,success:callback,error:error});},copyForm:function(source,to){$(source).find('input').each(function(){var name=$(this).attr('name');var targetField=$(to).find("input[name='"+name+"']");targetField.val($(this).val());});$(source).find('select').each(function(){var value=$(this).find('option:selected').val();$(to).find("select[name='"+$(this).attr('name')+"']").find("option[value='"+value+"']").prop('selected',false);});},clearForm:function(form){$(form).find("input[type=text], select, textarea").val('');},hasErrors:function(attributes){var hasErrors=false;attributes&&Object.keys(attributes).forEach(function(key){hasErrors|=(key.toLowerCase().indexOf("error")>-1);});return hasErrors;},hasAttributes:function(attributes){return attributes&&Object.keys(attributes).length>0;},scroll:function(selector,speed,offset){var $object=null;if(selector instanceof jQuery){$object=selector;}else{$object=$(selector);}
if(!$object||$object.length==0)
return;if(typeof speed==='undefined'){speed=2000;}
if(typeof offset==='undefined'){offset=$object.offset().top;}else{offset=$object.offset().top-offset}
$('html, body').animate({scrollTop:offset},speed);},nextCheckoutSection:function(){var $widget=$(".eCommerceCheckoutFieldsWidget .scroll-focus").closest('.widget');if($(window).width()>992){literatum.utils.scroll($widget,800,10);}else{literatum.utils.scroll($widget,800,60);}},getCountryState:function(iso2Alpha,callback){return literatum.utils.send({action:'getCountryStates',country:iso2Alpha},callback);}};if($(".add-to-cart").length>0){$("body").on("click",function(e){var $target=$(e.target);if(!$target.hasClass("add-to-cart")&&$target.closest(".add-to-cart").length==0){$(".add-to-cart").removeClass("opened");$(".add-to-cart").find(".purchaseArea").slideUp();}});}
$.fn.serializeObject=function()
{var o={};var a=this.serializeArray();console.log("Form");console.log(a);$.each(a,function(){if(o[this.name]!==undefined){if(!o[this.name].push){o[this.name]=[o[this.name]];}
o[this.name].push(this.value||'');}else{o[this.name]=this.value||'';}});return o;};


commerce.binders=(function(){var instance={};instance.removeDiscount=function(e){e.preventDefault();commerce.cart.discounts.remove($(this).data('discount'));};instance.disableDiscount=function(e){e.preventDefault();commerce.cart.discounts.disable($(this).data('discount'));};instance.removeItem=function(e){e.preventDefault();commerce.cart.buyingList.remove($(this).data("item-id"));};instance.submitBilling=function(e){e.preventDefault();commerce.cart.billing.update($("form.billing").serializeObject());};instance.editBilling=function(e){e.preventDefault();literatum.widgets.billing.render({},{editing:true});};instance.expandBilling=function(e){e.preventDefault();$(".billingAddress").slideToggle();};instance.sameAsShipping=function(e){if($(this).is(":checked")){literatum.utils.copyForm('.checkoutShipping form','.billingPayment form')}else{literatum.utils.clearForm('.billingPayment form');}};instance.countryChanged=function(e){var countryCode=$(this).val();var $state=$(this).closest("form").find("select[name='state']");if($state.find("option[data-country='"+countryCode+"']").length>0){$state.find("option:not([data-country='"+countryCode+"'])").hide();$state.find("option[data-country='"+countryCode+"']").show();if(!$state.is(":visible")){$state.parent().slideDown();}}else{$state.parent().slideUp();}
$state.val(null);};instance.bind=function(){$("*[data-bind]").each(function(){var binderName=$(this).data("bind");console.log("Binding '"+binderName+"' to element '"+this+"'");var binder=instance[binderName];$(this).on('click',binder);});};instance.unbind=function(){$("*[data-bind]").each(function(){try{var binderName=$(this).data("bind");var binder=instance[binderName];$(this).off('click',binder);}catch(e){console.log(e);}});};return instance;}());function registerListeners(){try{commerce.binders.unbind();}catch(e){console.log(e);}
try{commerce.binders.bind();}catch(e){commerce.binders.unbind();}};


commerce.cart=(function(){var instance={};var cartInfo;var listeners={};var callbacks=[];var errorHandler;var debugLog=function(message){var hostname=window.location.hostname;var isProduction=!hostname.includes('stag')&&!hostname.includes('test')&&!hostname.includes('localhost');if(!isProduction){console.log(message);}};function triggerRefresh(updatedCartInfo){debugLog("Trying to refresh current cart state...");Object.keys(listeners).forEach(function(key){commerce.cart.notify(key,updatedCartInfo);});cartInfo=updatedCartInfo;}
instance.refresh=function(){literatum.utils.send({action:'showCart'},triggerRefresh,errorHandler);};instance.identity={name:'identity',guest:function(email,acceptTermsConditions){literatum.utils.send({action:'guestCheckout',email:email,acceptTermsConditions:acceptTermsConditions},function(response){if(response.guestRedirectPath){var baseUrl=window.location.origin;var fullUrl=baseUrl+response.guestRedirectPath;window.location.href=fullUrl;}else{commerce.cart.identity.refresh(response);}},errorHandler);},login:function(email,password){literatum.utils.send({action:'doLogin',email:email,password:password},commerce.cart.identity.refresh,errorHandler);},registration:function(email){literatum.utils.send({action:'register',email:email},commerce.cart.identity.refresh,errorHandler);},clear:function(){literatum.utils.send({action:'resetCartAction'},commerce.cart.identity.refresh,errorHandler);},refresh:function(cartInfo){commerce.cart.notify(commerce.cart.identity,cartInfo);},changed:function(updatedCartInfo){return(cartInfo==null||cartInfo.identityHash!=updatedCartInfo.identityHash);}};instance.buyingList={name:'buyingList',addItem:function(itemId){literatum.utils.send({action:'addToCart',id:itemId},commerce.cart.buyingList.refresh,errorHandler);},remove:function(itemId){literatum.utils.send({action:'removeCartItem',id:itemId},commerce.cart.buyingList.refresh,errorHandler);},decreaseQuantity:function(itemId){literatum.utils.send({action:'decreaseQuantity',id:itemId},commerce.cart.buyingList.refresh,errorHandler);},increaseQuantity:function(itemId){literatum.utils.send({action:'increaseQuantity',id:itemId},commerce.cart.buyingList.refresh,errorHandler);},updateQuantity:function(itemId,currentQuantity,requiredQuantity){literatum.utils.send({action:'updateQuantity',id:itemId,currentQuantity:currentQuantity,requiredQuantity:requiredQuantity},commerce.cart.buyingList.refresh,errorHandler);},refresh:function(cartInfo){commerce.cart.notify(commerce.cart.buyingList,cartInfo);},changed:function(updatedCartInfo){return(cartInfo==null||cartInfo.buyingItemHash!=updatedCartInfo.buyingItemHash);}};instance.restoreAccess={name:'restoreAccess',request:function(email){literatum.utils.send({action:'restoreContentAccess',email:email},commerce.cart.restoreAccess.refresh,errorHandler);},refresh:function(cartInfo){commerce.cart.notify(commerce.cart.restoreAccess,cartInfo);},changed:function(updatedCartInfo){return true;}};instance.discounts={name:'discounts',apply:function(discountCode){literatum.utils.send({action:'applyDiscount',discount:discountCode},commerce.cart.discounts.refresh,errorHandler);},remove:function(discountCode){literatum.utils.send({action:'removeDiscount',discount:discountCode},commerce.cart.discounts.refresh,errorHandler);},enable:function(discountCode){literatum.utils.send({action:'enableDiscount',discount:discountCode},commerce.cart.discounts.refresh,errorHandler);},disable:function(discountCode){literatum.utils.send({action:'disableDiscount',discount:discountCode},commerce.cart.discounts.refresh,errorHandler);},refresh:function(cartInfo){commerce.cart.notify(commerce.cart.discounts,cartInfo);},changed:function(updatedCartInfo){return(cartInfo==null||cartInfo.cartHash!=updatedCartInfo.cartHash);}};instance.summary={name:'summary',refresh:function(){commerce.cart.notify(commerce.cart.summary,cartInfo);},changed:function(updatedCartInfo){return(cartInfo==null||cartInfo.cartHash!=updatedCartInfo.cartHash);}};instance.shipping={name:'shipping',update:function(form){var request={};$.extend(request,{action:'updateShippingAddress'},form);literatum.utils.send(request,commerce.cart.shipping.refresh,errorHandler);},getShippingCosts:function(country,state,callback){literatum.utils.send({action:'getShippingCosts',country:country,state:state},callback);},refresh:function(cartInfo){commerce.cart.notify(commerce.cart.shipping,cartInfo);},changed:function(updatedCartInfo){return(cartInfo==null||cartInfo.shippingHash!=updatedCartInfo.shippingHash||cartInfo.buyingItemHash!=updatedCartInfo.buyingItemHash||cartInfo.identityHash!=updatedCartInfo.identityHash);}};instance.tax={name:'tax',update:function(form){var request={};$.extend(request,{action:'updateTax'},form);literatum.utils.send(request,commerce.cart.tax.refresh,errorHandler);},refresh:function(cartInfo){commerce.cart.notify(commerce.cart.tax,cartInfo);},changed:function(updatedCartInfo){return(cartInfo==null||cartInfo.cartHash!=updatedCartInfo.cartHash);}};instance.billing={name:'billing',update:function(form){var request={};$.extend(request,{action:'updateBillingAddress'},form);literatum.utils.send(request,commerce.cart.billing.refresh,errorHandler);},refresh:function(cartInfo){commerce.cart.notify(commerce.cart.billing,cartInfo);},changed:function(updatedCartInfo){return(cartInfo==null||cartInfo.billingHash!=updatedCartInfo.billingHash||cartInfo.identityHash!=updatedCartInfo.identityHash);}};instance.savedItems={name:'savedItems',saveById:function(itemId){literatum.utils.send({action:'saveItem',id:itemId},commerce.cart.savedItems.refresh,errorHandler);},saveByDoi:function(doi){literatum.utils.send({action:'saveItem',doi:doi},commerce.cart.savedItems.refresh,errorHandler);},remove:function(id){literatum.utils.send({action:'removeSavedItem',id:id},commerce.cart.savedItems.refresh,errorHandler);},refresh:function(cartInfo){commerce.cart.notify(commerce.cart.savedItems,cartInfo);},changed:function(updatedCartInfo){return(cartInfo==null||cartInfo.savedItemsHash!=updatedCartInfo.savedItemsHash);}};instance.register=function(service,callback){debugLog("Commerce Cart :: Registering service "+service.name+" listener...");if(service){var serviceName=typeof service==='string'?service:service.name;if(!listeners[serviceName]){listeners[serviceName]=[];}
listeners[serviceName].push(callback);}};instance.notify=function(service,updatedCartInfo){if(updatedCartInfo){if(updatedCartInfo.sessionChanged){location.reload();return;}}
if(updatedCartInfo&&cartInfo){if(cartInfo.sessionHash!=updatedCartInfo.sessionHash){location.reload();return;}}
var result=[];var serviceName=typeof service==='string'?service:service.name;debugLog("Commerce Cart :: Notifying "+serviceName+" listeners...");if(typeof serviceName==='string'||(service&&service.changed&&service.changed(updatedCartInfo))||literatum.utils.hasAttributes(updatedCartInfo.attributes)){if(listeners[serviceName]){listeners[serviceName].forEach(function(listener){var value=listener(updatedCartInfo);result.push(value);});}}
var clone=callbacks;$.when.apply($,result).then(function(){clone.forEach(function(callback){callback();});});commerce.cart.clearCallbacks();if(updatedCartInfo){cartInfo=updatedCartInfo;}};instance.setErrorHandler=function(handler){errorHandler=handler;};instance.addCallback=function(callback){callbacks.push(callback);};instance.clearCallbacks=function(){callbacks=[];};instance.debugLog=debugLog;return instance;}());(function(){var hostname=window.location.hostname;var isProduction=!hostname.includes('stag')&&!hostname.includes('test')&&!hostname.includes('localhost');if(!isProduction){console.log("Cart Service initialized!");}})();$(document).ready(function(){instructorServiceWarningMessage();});$(document).ajaxComplete(function(event,request,settings){if(settings.url.startsWith("/pb/widgets/commerce/buyingItems")){instructorServiceWarningMessage();}});function instructorServiceWarningMessage(){if($(".checkoutDropZone").length>0){if($(".instructor__warning__message__text").length>0){if($(".instructor__warning__message__clone").length>0){$(".instructor__warning__message__text").remove();}else{$(".instructor__warning__message__text").addClass("instructor__warning__message__clone");$(".instructor__warning__message__clone").removeClass("instructor__warning__message__text");$(".instructor__warning__message__clone").clone().prependTo($(".checkoutDropZone").closest(".row").parent());$(".instructor__warning__message__clone").last().remove();$(".instructor__warning__message__clone").css("display","");}}else{$(".instructor__warning__message__clone").remove();}}
setTimeout(function(){$(".instructor__warning__message__text").fadeOut("fast");},50);};


commerce.validators=(function(){var instance={};var creditCardsPattern={};creditCardsPattern['visa']=new RegExp("^4[0-9]{12}(?:[0-9]{3})?$");creditCardsPattern['mastercard']=new RegExp("^[25][1-5][0-9]{14}$");creditCardsPattern['amex']=new RegExp("^3[47][0-9]{13}$");creditCardsPattern['dinner']=new RegExp("^3(?:0[0-5]|[68][0-9])[0-9]{11}$");creditCardsPattern['discover']=new RegExp("^6(?:011|5[0-9]{2})[0-9]{12}$");creditCardsPattern['jcb']=new RegExp("^(?:2131|1800|35\\d{3})\\d{11}$");creditCardsPattern['maestro']=new RegExp("^(5018|5020|5038|5893|6304|6759|6761|6762|6763)[0-9]{8,15}$");instance.creditcard=function(value,element){var number=value.match(/\d/g);if(!number)
return true;value=number.join("");var invalid=true;$(element).closest(".input-group").prop("class","input-group cc-number");Object.keys(creditCardsPattern).forEach(function(k){if(creditCardsPattern[k].test(value)&&invalid&&/^\d+$/.test($("#realNumber").val())){invalid=false;$(element).closest(".input-group").addClass(k);}});return invalid;};instance.creditcardDate=function(value,element,form){var currentDate=new Date();var currentMonth=currentDate.getMonth(5)+1;var currentYear=currentDate.getFullYear();var monthExpiry=form.find("select[name='expMonth']").val();var yearExpiry=form.find("select[name='expYear']").val();var expireMonth=parseInt(monthExpiry);var expireYear=parseInt(yearExpiry);var expireDate=new Date();expireDate.setMonth(expireMonth-1);expireDate.setYear(expireYear);if(expireYear=="0000"||expireMonth=="00")
return true;if(currentYear>expireYear){return true;}
if(currentMonth>expireMonth&&monthExpiry=="00"){return true;}
return expireDate<currentDate;};instance.notEmpty=function(value){return!(!!(value));};instance.validate=function(form){var $form=null;var invalid=true;if(form instanceof jQuery){$form=form;}else{$form=$(form);}
$form.find("input[data-validate]").each(function(){var $this=$(this);invalid=commerce.validators.validateField($this,$form)&&invalid;});return invalid;};instance.validateField=function(field,form){var $field=null;if(field instanceof jQuery){$field=field;}else{$field=$(field);}
var validatorName=$field.data("validate");var validator=instance[validatorName];var value=$field.val();return validator(value,$field,form);};instance.securityCode=function(value){return!(/^[0-9]{3,4}$/.test(value));};return instance;}());


commerce.Notification=function(element){if(element instanceof jQuery){this.$element=element;}else{this.$element=$(element);}
this.$p=$(this.$element.find("p"));};commerce.Notification.dummy=new commerce.Notification("<div></div>");commerce.Notification.prototype.show=function(){this.$element.show();this.$element.removeClass('hidden');};commerce.Notification.prototype.showFlex=function(){this.$element.css('display','flex');this.$element.removeClass('hidden');};commerce.Notification.get=function(element){return new commerce.Notification(element);};commerce.Notification.create=function(element){if(!(element instanceof jQuery)){element=$(element);}
element.html("<p></p>");return new commerce.Notification(element);};commerce.Notification.prototype.hide=function(){this.$element.hide();};commerce.Notification.prototype.reset=function(){this.$p.removeClass("itemAddedMsgBox");this.$p.removeClass("errorMsgBox");this.$element.hide();};commerce.Notification.prototype.error=function(){this.$p.removeClass("itemAddedMsgBox");this.$p.addClass("errorMsgBox");this.$p.parent(".purchaseMessage").addClass("errorMsgParent");this.$p.parent(".purchaseMessage").removeClass("hidden");};commerce.Notification.prototype.warning=function(){this.$p.removeClass("itemAddedMsgBox");this.$p.addClass("errorMsgBox");};commerce.Notification.prototype.info=function(){this.$p.removeClass("errorMsgBox");this.$p.addClass("itemAddedMsgBox");};commerce.Notification.prototype.setMessage=function(message){this.$p.html(message);};commerce.FieldNotification=function(element){if(element instanceof jQuery){this.$element=element;}else{this.$element=$(element);}
this.$message=$(this.$element.find(".message"));this.$label=$(this.$element.find(".label"));this.$show=$(this.$element.find(".field-info"));};commerce.FieldNotification.prototype.show=function(){if(this.$message.text().length>0){this.$show.show();this.$show.removeClass("hidden");}else{this.$show.hide();}};commerce.FieldNotification.get=function(element){return new commerce.FieldNotification(element);};commerce.FieldNotification.prototype.hide=function(){this.$show.hide();};commerce.FieldNotification.prototype.error=function(){this.$label.removeClass("warning");this.$label.removeClass("info");this.$label.addClass("error");};commerce.FieldNotification.prototype.warning=function(){this.$label.removeClass("error");this.$label.removeClass("info");this.$label.addClass("warning");};commerce.FieldNotification.prototype.info=function(){this.$label.removeClass("warning");this.$label.removeClass("error");this.$label.addClass("info");};commerce.FieldNotification.prototype.reset=function(){this.hide();this.$label.removeClass("warning");this.$label.removeClass("error");this.$label.removeClass("info");this.setMessage("");};commerce.FieldNotification.prototype.setMessage=function(message){this.$message.html(message);};


commerce.BuyingItemWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.buyingList);this.register(commerce.cart.discounts);this.register(commerce.cart.savedItems);this.register(commerce.cart.summary);this.register("quantityIncreased");this.register("quantityDecreased");this.register("updateQuantity");var $widgetUpdatableHolder=this.get().find('.articleDataContainer');if($widgetUpdatableHolder.length>0&&$widgetUpdatableHolder.data('widget-updatable')){this.register(commerce.cart.billing);}};commerce.BuyingItemWidget.prototype=new literatum.Widget();commerce.BuyingItemWidget.id='eCommerceCheckoutBuyingItemsWidget';commerce.BuyingItemWidget.action='/pb/widgets/commerce/buyingItems';commerce.BuyingItemWidget.notifications={info:commerce.Notification};commerce.BuyingItemWidget.binders={applyDiscount:function(e,widget){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.discounts.apply(widget.find("input[name='discount']").val());},removeDiscount:function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.discounts.remove($(this).data('discount'));},disableDiscount:function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.discounts.disable($(this).data('discount'));},enableDiscount:function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.discounts.enable($(this).data('discount'));},saveItem:function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();var itemId=$(this).data("item-id");if(itemId){commerce.cart.savedItems.saveById(itemId);}else{commerce.cart.savedItems.saveByDoi($(this).data("item-doi"));}},removeItem:function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.buyingList.remove($(this).data("item-id"));},increaseQuantity:function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.buyingList.increaseQuantity($(this).data("item-id"));},decreaseQuantity:function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.buyingList.decreaseQuantity($(this).data("item-id"));},updateQuantity:function(e){var currentQuantity=$(this).parent().find("#quantity").attr("value");var requiredQuantity=$(this).parent().find("#quantity").val();var MAXIMUM_ALLOWED_VALUE=$(this).attr("data-max-quote-items");if(Number(requiredQuantity)<1||Number(requiredQuantity)>Number(MAXIMUM_ALLOWED_VALUE)){$(this).parent().find(".quantity_number.error").removeClass("hidden");}
else{$(this).parent().find(".quantity_number.error").addClass("hidden");if(currentQuantity!=requiredQuantity){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.buyingList.updateQuantity($(this).data("item-id"),currentQuantity,requiredQuantity);}}}};commerce.BuyingItemWidget.prototype.reset=function(){Object.getPrototypeOf(commerce.BuyingItemWidget.prototype).reset.call(this);this.find("input[name='discount']").removeClass("errorMsg");this.find(".promoCodeMsg .errorMsg").hide();this.find(".promoCodeMsg .infoMsg").hide();};commerce.BuyingItemWidget.infoHandlers={discountError:function(message,widget){widget.find(".promoCodeMsg .infoMsg").hide();widget.find("input[name='discount']").addClass("errorMsg");var $error=widget.find(".promoCodeMsg .errorMsg");$error.html(message);$error.show();},discountInfo:function(message,widget){widget.find(".promoCodeMsg .errorMsg").hide();widget.find("input[name='discount']").removeClass("errorMsg");var $info=widget.find(".promoCodeMsg .infoMsg");$info.html(message);$info.show();},discount:function(message,widget){$(widget.find("input[name='promoCode']")).val(message);},savedItemError:function(message,widget){var notification=widget.getNotification('info');if(notification){notification.error();notification.setMessage(message);notification.show();}},error:function(message,widget){var notification=widget.getNotification('info');if(notification){notification.error();notification.setMessage(message);notification.show();}}};commerce.BuyingItemWidget.prototype.registerListeners=function(){Object.getPrototypeOf(commerce.BuyingItemWidget.prototype).registerListeners.call(this);var widget=this;var $applyButton=this.find("#applyDiscountForm input.applyDiscount");var $discountField=this.find("input[name='discount']");$discountField.on('keyup',function(){if($discountField.val()){$applyButton.addClass('primary');$applyButton.prop('disabled',false);}else{$applyButton.removeClass('primary');$applyButton.prop('disabled',true);widget.find(".promoCodeMsg .errorMsg").hide();widget.find("input[name='discount']").removeClass("errorMsg");var $info=widget.find(".promoCodeMsg .infoMsg");$info.html(message);$info.show();}});};commerce.BuyingItemWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.BuyingItemWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.BuyingItemWidget.id);};literatum.widgets.register(commerce.BuyingItemWidget);


commerce.SavedItemsWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.buyingList);this.register(commerce.cart.savedItems);this.register(commerce.cart.identity);};commerce.SavedItemsWidget.prototype=new literatum.Widget();commerce.SavedItemsWidget.id='eCommerceCheckoutSavedForLaterItemsWidget';commerce.SavedItemsWidget.action='/pb/widgets/commerce/savedItems';commerce.SavedItemsWidget.notifications={info:commerce.Notification};commerce.SavedItemsWidget.binders={saveItem:function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();var itemId=$(this).data("item-id");if(itemId){commerce.cart.savedItems.saveById(itemId);}else{commerce.cart.savedItems.saveByDoi($(this).data("item-doi"));}},removeSavedItem:function(e,widget){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.savedItems.remove($(this).data("item-id"));},expand:function(e){e.preventDefault();$(this).closest(".add-to-cart").toggleClass("opened");var offerAddToCart=$(this).next(".purchaseArea");var offerVisibility=$(this).next(".purchaseArea").is(':visible');$(".purchaseArea").slideUp();if(!offerVisibility){$(this).next(".purchaseArea").slideToggle();var subject=$(".demo");if(e.target.id!=subject.attr('id')){subject.show();offerAddToCart.removeClass('hidden');}}},addItem:function(e,widget){if(!$(e.target).parents('.disable-click').length){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();var key=$(this).attr("data-key");commerce.cart.buyingList.addItem(key);}}};commerce.SavedItemsWidget.prototype.registerListeners=function(){Object.getPrototypeOf(commerce.SavedItemsWidget.prototype).registerListeners.call(this);if($(window).width()>=992){$(document).on('touchend click',function(e){var container=$(".demoContainer");if(!$(e.target).closest('.superDemo').length){$(".add-to-cart.opened").removeClass("opened");container.hide();container.find('.add-journal-to-cart').removeClass('disable-click');container.find('.add-journal-to-cart header').removeClass('open');container.find('.add-journal-to-cart').css('margin-bottom','10px');e.stopPropagation();}});}};commerce.SavedItemsWidget.infoHandlers={savedItemError:function(message,widget){var notification=widget.getNotification('info');if(notification){notification.setMessage(message);notification.error();notification.show();}}};commerce.SavedItemsWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.SavedItemsWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.SavedItemsWidget.id);};literatum.widgets.register(commerce.SavedItemsWidget);


commerce.RecommendedWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.identity);this.register(commerce.cart.buyingList);this.register(commerce.cart.savedItems);};commerce.RecommendedWidget.prototype=new literatum.Widget();commerce.RecommendedWidget.id='eCommerceCheckoutRecommendedItemsWidget';commerce.RecommendedWidget.action='/pb/widgets/commerce/recommended';commerce.RecommendedWidget.binders={expand:function(e){e.preventDefault();$(this).closest(".add-to-cart").toggleClass("opened");var offerAddToCart=$(this).next(".purchaseArea");var offerVisibility=$(this).next(".purchaseArea").is(':visible');$(".purchaseArea").slideUp();if(!offerVisibility){$(this).next(".purchaseArea").slideToggle();var subject=$(".demo");if(e.target.id!=subject.attr('id')){subject.show();offerAddToCart.removeClass('hidden');}}},addItem:function(e){if(!$(e.target).parents('.disable-click').length){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();var key=$(this).attr("data-key");commerce.cart.buyingList.addItem(key);}},saveItem:function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();var itemId=$(this).data("item-id");if(itemId){commerce.cart.savedItems.saveById(itemId);}else{commerce.cart.savedItems.saveByDoi($(this).data("item-doi"));}}};commerce.RecommendedWidget.prototype.registerListeners=function(){Object.getPrototypeOf(commerce.RecommendedWidget.prototype).registerListeners.call(this);if($(window).width()>=992){$(document).on('touchend click',function(e){var container=$(".demoContainer");if(!$(e.target).closest('.superDemo').length){$(".add-to-cart.opened").removeClass("opened");container.hide();container.find('.add-journal-to-cart').removeClass('disable-click');container.find('.add-journal-to-cart header').removeClass('open');container.find('.journal-options-expanded').hide();container.find('.add-journal-to-cart').css('margin-bottom','10px');e.stopPropagation();}});}};commerce.RecommendedWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.RecommendedWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.RecommendedWidget.id);};literatum.widgets.register(commerce.RecommendedWidget);


commerce.RecentlyViewedWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.identity);this.register(commerce.cart.buyingList);this.register(commerce.cart.savedItems);};commerce.RecentlyViewedWidget.prototype=new literatum.Widget();commerce.RecentlyViewedWidget.id='eCommerceCheckoutRecentlyViewedItemsWidget';commerce.RecentlyViewedWidget.action='/pb/widgets/commerce/recentlyViewed';commerce.RecentlyViewedWidget.binders={expand:function(e){e.preventDefault();$(this).closest(".add-to-cart").toggleClass("opened");var offerAddToCart=$(this).next(".purchaseArea");var offerVisibility=$(this).next(".purchaseArea").is(':visible');$(".purchaseArea").slideUp();if(!offerVisibility){$(this).next(".purchaseArea").slideToggle();var subject=$(".demo");if(e.target.id!=subject.attr('id')){subject.show();offerAddToCart.removeClass('hidden');}}},addItem:function(e,widget){if(!$(e.target).parents('.disable-click').length){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();var key=$(this).attr("data-key");commerce.cart.buyingList.addItem(key);}},saveItem:function(e,widget){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();var itemId=$(this).data("item-id");if(itemId){commerce.cart.savedItems.saveById(itemId);}else{commerce.cart.savedItems.saveByDoi($(this).data("item-doi"));}}};commerce.RecentlyViewedWidget.prototype.registerListeners=function(){Object.getPrototypeOf(commerce.RecentlyViewedWidget.prototype).registerListeners.call(this);if($(window).width()>=992){$(document).on('touchend',function(e){var container=$(".demoContainer");if(!$(e.target).closest('.superDemo').length){$(".add-to-cart.opened").removeClass("opened");container.hide();container.find('.add-journal-to-cart').removeClass('disable-click');container.find('.add-journal-to-cart header').removeClass('open');container.find('.journal-options-expanded').hide();container.find('.add-journal-to-cart').css('margin-bottom','10px');e.stopPropagation();}});}};commerce.RecentlyViewedWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.RecentlyViewedWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.RecentlyViewedWidget.id);};literatum.widgets.register(commerce.RecentlyViewedWidget);


commerce.OrderSummaryWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.identity);this.register(commerce.cart.buyingList);this.register(commerce.cart.discounts);this.register(commerce.cart.savedItems);this.register(commerce.cart.shipping);this.register(commerce.cart.billing);this.register(commerce.cart.tax);this.register(commerce.cart.summary);this.register("quantityIncreased");this.register("quantityDecreased");this.register("updateQuantity");};commerce.OrderSummaryWidget.prototype=new literatum.Widget();commerce.OrderSummaryWidget.id='eCommerceCheckoutSummaryWidget';commerce.OrderSummaryWidget.action='/pb/widgets/commerce/orderSummary';commerce.OrderSummaryWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.OrderSummaryWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.OrderSummaryWidget.id);};literatum.widgets.register(commerce.OrderSummaryWidget);commerce.OrderSummaryWidget.binders={removeItem:function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.buyingList.remove($(this).data("item-id"));}};


commerce.IdentityWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.identity);this.register(commerce.cart.buyingList);this.register(commerce.cart.savedItems);};commerce.IdentityWidget.prototype=new literatum.Widget();commerce.IdentityWidget.id='eCommerceCheckoutIdentityWidget';commerce.IdentityWidget.action='/pb/widgets/commerce/identity';commerce.IdentityWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.IdentityWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.IdentityWidget.id);};commerce.IdentityWidget.notifications={identity:commerce.Notification,email:commerce.FieldNotification,acceptTermsConditions:commerce.FieldNotification};commerce.IdentityWidget.binders={guest:function(e,widget){e.preventDefault();var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(literatum.utils.nextCheckoutSection);commerce.cart.addCallback(loading.done);var acceptTermsConditions=widget.find("input[name='acceptTermsConditions']").is(":checked");commerce.cart.identity.guest(widget.find("input[name='email'].user").val(),acceptTermsConditions);},showUserLogin:function(e,widget){e.preventDefault();var $loginForm=widget.find(".frmLogin");var email=widget.find("input[name='email'].user").val();widget.find(".checkoutLogin").hide();if($loginForm.length>0){$loginForm.show();$loginForm.removeClass('hidden');if(email!=undefined){$loginForm.find("input[name='login']").val(email).focus();}}},register:function(e,widget){var email=widget.find("input[name='email'].user").val();if(email){e.preventDefault();window.location="/action/registration?email="+encodeURIComponent(email)+"&redirectUri="+encodeURIComponent(location.href);}},cancelLogin:function(e,widget){e.preventDefault();var notification=widget.getNotification("identity");if(notification){notification.reset();}
widget.find(".message.error").remove();widget.find(".checkoutLogin").show();if(widget.find(".frmLogin").length>0){widget.find(".frmLogin").hide();}},userLogin:function(e){var loading=new literatum.FullPageLoading();loading.start();},resetCart:function(e){var loading=new literatum.FullPageLoading();loading.start();},expand:function(e,widget){widget.find(".checkout-expand").slideToggle();}};commerce.IdentityWidget.prototype.registerListeners=function(){Object.getPrototypeOf(commerce.IdentityWidget.prototype).registerListeners.call(this);if(this.find(".frmLogin").length>0){var $loginInput=this.find(".frmLogin .login");var $passwordInput=this.find(".frmLogin .password");var $continueButton=this.find(".frmLogin input[type='submit']");$continueButton.removeClass("primary");$continueButton.prop('disabled',true);$loginInput.on('keyup',function(){if($loginInput.val()&&$passwordInput.val()){$continueButton.addClass("primary");$continueButton.prop('disabled',false);}else{$continueButton.removeClass("primary");$continueButton.prop('disabled',true);}});$passwordInput.on('keyup',function(){if($loginInput.val()&&$passwordInput.val()){$continueButton.addClass("primary");$continueButton.prop('disabled',false);}else{$continueButton.removeClass("primary");$continueButton.prop('disabled',true);}});}};commerce.IdentityWidget.prototype.triggerInfoHandlers=function(widget,model){Object.getPrototypeOf(commerce.IdentityWidget.prototype).triggerInfoHandlers.call(this,widget,model);widget.find("input,select").each(function(){var $this=$(this);var name=$this.attr('name');var errorName=name+"Error";var notification=widget.getNotification(name);if(notification){notification.reset();if(model&&model.attributes&&model.attributes[errorName]){notification.error();notification.setMessage(model.attributes[errorName]);notification.show();}}});};commerce.IdentityWidget.infoHandlers={identityError:function(message,widget){var notification=widget.getNotification("identity");if(notification){notification.setMessage(message);notification.error();notification.show();}},emailError:function(message,widget){var notification=widget.getNotification("email");if(notification){notification.error();notification.setMessage(message);notification.show();}},acceptTermsConditionsError:function(message,widget){var notification=widget.getNotification("acceptTermsConditions");if(notification){notification.error();notification.setMessage(message);notification.show();}}};literatum.widgets.register(commerce.IdentityWidget);


commerce.ShippingWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.identity);this.register(commerce.cart.buyingList);this.register(commerce.cart.savedItems);this.register(commerce.cart.shipping);};commerce.ShippingWidget.prototype=new literatum.Widget();commerce.ShippingWidget.id='eCommerceCheckoutShippingWidget';commerce.ShippingWidget.action='/pb/widgets/commerce/shipping';commerce.ShippingWidget.notifications={info:commerce.Notification,givennames:commerce.FieldNotification,surname:commerce.FieldNotification,email:commerce.FieldNotification,phone:commerce.FieldNotification,organization:commerce.FieldNotification,address1:commerce.FieldNotification,address2:commerce.FieldNotification,city:commerce.FieldNotification,country:commerce.FieldNotification,state:commerce.FieldNotification,zipCode:commerce.FieldNotification,shippingCost:commerce.FieldNotification};commerce.ShippingWidget.prototype.lostFocus=function(){if(this.find("form").length){return literatum.widgets.render(this,{},{});}};commerce.ShippingWidget.binders={editShipping:function(e,widget){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(literatum.utils.nextCheckoutSection);commerce.cart.addCallback(loading.done);e.preventDefault();var d=literatum.widgets.render(widget,{},{editing:true});literatum.widgets.all().forEach(function(item){if(widget.widgetDef.id!=item.widgetDef.id){d=d.then(item.lostFocus());}});d.then(function(){literatum.utils.nextCheckoutSection();loading.done();});},submitShipping:function(e,widget){e.preventDefault();var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(literatum.utils.nextCheckoutSection);commerce.cart.addCallback(loading.done);commerce.cart.shipping.update(widget.find("form").serializeObject());},shippingOptions:function(e,widget){e.preventDefault();var forms=widget.collectForms();commerce.cart.shipping.shippingOptions(forms.shipping.country,forms.shipping.state)},expand:function(e,widget){widget.find(".checkout-expand").slideToggle();},countryChanged:function(e,widget){if(e.type==='change'){var loading=new literatum.FullPageLoading();loading.start();var notification=widget.getNotification('shippingCost');if(notification){notification.reset();}
var $country=widget.find("select[name='country']");var $state=widget.find(".state option:selected");var countryCode=$country.val();if(countryCode=="US"){widget.find(".zipcode label").text(widget.find(".zipcode-text").text())}else{widget.find(".zipcode label").text(widget.find(".postcode-text").text())}
literatum.utils.getCountryState(countryCode,function(model){var $states=widget.find(".state");var $select=$states.find("select");$select.val(null);$select.find("option:not([value='-1'])").remove();if(model.states.length>0){model.states.forEach(function(item){$select.append('<option value="'+item['id']+'">'+item['description']+'</option>');});$states.show();}else{$states.hide();}
$select.val($state.val());commerce.cart.shipping.getShippingCosts(countryCode,$select.val(),function(model){if(model.shippingOptions.length!=1){var $shippingOptions=widget.find(".shipping-cost-select");var $select=$shippingOptions.find("select");$select.find("option:not([value='-1'])").remove();model.shippingOptions.forEach(function(item){$select.append('<option value="'+item['id']+'">'+item['description']+'</option>');});if(model.error){notification.reset();notification.error();notification.setMessage(model.error);notification.show();}
widget.find(".shipping-cost-one input").prop('disabled',true);widget.find(".shipping-cost-select select").prop('disabled',false);widget.find(".shipping-cost-one").hide();widget.find(".shipping-cost-select").show();}else{widget.find(".shipping-cost-select select").prop('disabled',true);widget.find(".shipping-cost-one input[name='shippingCost']").prop('disabled',false);widget.find(".shipping-cost-select").hide();widget.find("input[name='shippingCost']").val(model.shippingOptions[0].id);widget.find("input[name='shippingCostDescription']").val(model.shippingOptions[0].description);widget.find(".shipping-cost-one").show();}
loading.done();});});}},selectAddress:function(e,widget){var addressUuid=$(this).val();if(e.type=='change'){if(addressUuid!='-1'){var loading=new literatum.FullPageLoading();loading.start();widget.render({},{editing:true,uuid:addressUuid},function(){var $country=widget.find("select[name='country']");var $state=widget.find("select[name='state']");if($country.val()!=''){commerce.cart.shipping.getShippingCosts($country.val(),$state.val(),function(model){if(model.shippingOptions.length!=1){var $shippingOptions=widget.find(".shipping-cost-select");var $select=$shippingOptions.find("select");$select.find("option:not([value='-1'])").remove();model.shippingOptions.forEach(function(item){$select.append('<option value="'+item['id']+'">'+item['description']+'</option>');});if(model.error){var notification=widget.getNotification('shippingCost');notification.reset();notification.error();notification.setMessage(model.error);notification.show();}
widget.find(".shipping-cost-one input").prop('disabled',true);widget.find(".shipping-cost-select select").prop('disabled',false);widget.find(".shipping-cost-one").hide();widget.find(".shipping-cost-select").show();}else{widget.find(".shipping-cost-select select").prop('disabled',true);widget.find(".shipping-cost-one input[name='shippingCost']").prop('disabled',false);widget.find(".shipping-cost-select").hide();widget.find("input[name='shippingCost']").val(model.shippingOptions[0].id);widget.find("input[name='shippingCostDescription']").val(model.shippingOptions[0].description);widget.find(".shipping-cost-one").show();}
loading.done();});}else{loading.done();}});}else{widget.updateForm('shipping',{});}}}};commerce.ShippingWidget.infoHandlers={addressError:function(message,widget){var notification=widget.getNotification('info');if(notification){notification.error();notification.setMessage(message);notification.show();}
literatum.utils.scroll('.errorMsgBox:visible',0);}};commerce.ShippingWidget.prototype.triggerInfoHandlers=function(widget,model){Object.getPrototypeOf(commerce.ShippingWidget.prototype).triggerInfoHandlers.call(this,widget,model);widget.find("input,select").each(function(){var $this=$(this);var name=$this.attr('name');var errorName=name+"Error";var notification=widget.getNotification(name);if(notification){notification.reset();if(model&&model.attributes&&model.attributes[errorName]){notification.error();notification.setMessage(model.attributes[errorName]);notification.show();}}});};commerce.ShippingWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.ShippingWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.ShippingWidget.id);};literatum.widgets.register(commerce.ShippingWidget);


commerce.TaxWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.buyingList);this.register(commerce.cart.savedItems);this.register(commerce.cart.billing);this.register(commerce.cart.shipping);this.register(commerce.cart.tax);};commerce.TaxWidget.prototype=new literatum.Widget();commerce.TaxWidget.id='eCommerceCheckoutTaxWidget';commerce.TaxWidget.action='/pb/widgets/commerce/tax';commerce.TaxWidget.prototype.lostFocus=function(){if(this.find("form").length){return literatum.widgets.render(this,{},{});}};commerce.TaxWidget.binders={updateTax:function(e,widget){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(literatum.utils.nextCheckoutSection);commerce.cart.addCallback(loading.done);e.preventDefault();var d=literatum.widgets.render(widget,{},{editing:true});literatum.widgets.all().forEach(function(item){if(widget.widgetDef.id!=item.widgetDef.id){d=d.then(item.lostFocus());}});d.then(function(){literatum.utils.nextCheckoutSection();loading.done();});},tax:function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(literatum.utils.nextCheckoutSection);commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.tax.update($("form.tax").serializeObject());}};commerce.TaxWidget.notifications={countrySelect:commerce.FieldNotification};commerce.TaxWidget.infoHandlers={taxErrorMissingCountry:function(message,widget){var notification=widget.getNotification('countrySelect');if(notification){notification.error();notification.setMessage(message);notification.show();}}};commerce.TaxWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.TaxWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.TaxWidget.id);};literatum.widgets.register(commerce.TaxWidget);


commerce.BillingWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.identity);this.register(commerce.cart.shipping);this.register(commerce.cart.billing);this.register(commerce.cart.buyingList);this.register(commerce.cart.savedItems);};commerce.BillingWidget.prototype=new literatum.Widget();commerce.BillingWidget.id='eCommerceCheckoutBillingWidget';commerce.BillingWidget.action='/pb/widgets/commerce/billing';commerce.BillingWidget.notifications={info:commerce.Notification,givennames:commerce.FieldNotification,surname:commerce.FieldNotification,email:commerce.FieldNotification,phone:commerce.FieldNotification,organization:commerce.FieldNotification,address1:commerce.FieldNotification,address2:commerce.FieldNotification,city:commerce.FieldNotification,country:commerce.FieldNotification,state:commerce.FieldNotification,zipCode:commerce.FieldNotification};commerce.BillingWidget.prototype.lostFocus=function(){if(this.find("form").length){return literatum.widgets.render(this,{},{});}};commerce.BillingWidget.binders={submitBilling:function(e,widget){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(literatum.utils.nextCheckoutSection);commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.billing.update($("form[name='billing']").serializeObject());},editBilling:function(e,widget){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();var d=literatum.widgets.render(widget,{},{editing:true});literatum.widgets.all().forEach(function(item){if(widget.widgetDef.id!=item.widgetDef.id){d=d.then(item.lostFocus());}});const alertContainer=document.getElementById('billing-alert');if(alertContainer){alertContainer.textContent='Billing address form reopened for editing.';}
d.then(function(){literatum.utils.nextCheckoutSection();loading.done();var countryCode=$("#country").val();if(countryCode=="US"){widget.find(".zipcode label").text(widget.find(".zipcode-text").text())}else{widget.find(".zipcode label").text(widget.find(".postcode-text").text())}});},sameAsShipping:function(e,widget){if($(this).is(":checked")){var shippingWidgets=literatum.widgets.get('eCommerceCheckoutShippingWidget');var shippingWidget=shippingWidgets[0];if(shippingWidget){var forms=shippingWidget.collectForms();widget.updateForm('billing',forms['shipping'],true);widget.find("select[name='country']").change();}
var identityWidgets=literatum.widgets.get('eCommerceCheckoutIdentityWidget');var identityWidget=identityWidgets[0];if(identityWidget){var forms=identityWidget.collectForms();widget.updateForm('billing',forms['personal-info'],true);}}else{literatum.utils.clearForm('.billingPayment form',{});}},placeOrder:function(e,widget){if(!commerce.validators.validate(widget.find("form[name='apg']"))){e.preventDefault();}},expand:function(e,widget){widget.find(".checkout-expand").slideToggle();},countryChanged:function(e,widget){if(e.type=='change'){var loading=new literatum.FullPageLoading();loading.start();var countryCode=$(this).val();if(countryCode=="US"){widget.find(".zipcode label").text(widget.find(".zipcode-text").text())}else{widget.find(".zipcode label").text(widget.find(".postcode-text").text())}
literatum.utils.getCountryState(countryCode,function(model){var $states=widget.find(".state");var $select=$states.find("select");if(e.type=='change'){$select.val(null);}
var shippingWidget;var shippingForm;if(literatum.widgets.get('eCommerceCheckoutShippingWidget').length!==0){shippingWidget=literatum.widgets.get('eCommerceCheckoutShippingWidget');shippingForm=shippingWidget[0].collectForms()['shipping'];}
else{shippingForm="";}
var state="";if(shippingForm!==undefined)
state=shippingForm['state'];$select.find("option:not([value='-1'])").remove();if(model.states.length>0){$select.append('<option value="" selected> </option>');model.states.forEach(function(item){if(state===item['id'])
$select.append('<option value="'+item['id']+'" selected>'+item['description']+'</option>');else
$select.append('<option value="'+item['id']+'">'+item['description']+'</option>');});$states.show();}else{$states.hide();}
loading.done();});}},selectAddress:function(e,widget){var addressUuid=$(this).val();if(e.type=='change'){if(addressUuid!='-1'){var loading=new literatum.FullPageLoading();loading.start();widget.render({},{editing:true,uuid:addressUuid},function(){loading.done();});}else{widget.updateForm('billing',{});}}}};commerce.BillingWidget.infoHandlers={addressError:function(message,widget){var notification=widget.getNotification('info');if(notification){notification.error();notification.setMessage(message);notification.show();}
literatum.utils.scroll('.errorMsgBox:visible',0);}};commerce.BillingWidget.prototype.triggerInfoHandlers=function(widget,model){Object.getPrototypeOf(commerce.BillingWidget.prototype).triggerInfoHandlers.call(this,widget,model);var focusFlag=true;widget.find("input,select").each(function(){var $this=$(this);var name=$this.attr('name');var errorName=name+"Error";var notification=widget.getNotification(name);if(notification){notification.reset();if(model&&model.attributes&&model.attributes[errorName]){notification.error();notification.setMessage(model.attributes[errorName]);notification.show();if(focusFlag){$this.focus();focusFlag=false;}}}});};commerce.BillingWidget.prototype.validateForm=function(cartInfo){};commerce.BillingWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.BillingWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.BillingWidget.id);};literatum.widgets.register(commerce.BillingWidget);


commerce.PaymentWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.identity);this.register(commerce.cart.billing);this.register(commerce.cart.shipping);this.register(commerce.cart.buyingList);this.register(commerce.cart.savedItems);this.register(commerce.cart.discounts);this.register(commerce.cart.tax);var $error=this.find('.errorMsgBox').not('.hidden');if($error.length==0){$error=this.find(".label.error");}
if($error.length>0){if(commerce.page.cart.show!==undefined){commerce.page.cart.show();}
literatum.utils.scroll($error,800,100);}};commerce.PaymentWidget.prototype=new literatum.Widget();commerce.PaymentWidget.id='eCommerceCheckoutPaymentWidget';commerce.PaymentWidget.action='/pb/widgets/commerce/payment';commerce.PaymentWidget.notifications={holderName:commerce.FieldNotification,realNumber:commerce.FieldNotification,creditcardDate:commerce.FieldNotification,secNumber:commerce.FieldNotification};commerce.PaymentWidget.binders={expandPayment:function(e,widget){e.preventDefault();widget.find(".payment").slideToggle();},placeOrder:function(e,widget){var $form=widget.find("form[name='apg']");var valid=true;$form.find("input[data-validate],select[data-validate]").each(function(){var $this=$(this);var $group=$this.closest(".input-group");var invalid=commerce.validators.validateField($this,$form);var fieldsValidation=[];fieldsValidation.push(invalid);var notification=widget.getNotification($group.data('notification'));if(!notification){return;}
if(invalid){notification.reset();notification.setMessage('');notification.error();notification.show();}else{notification.reset()}
valid=!invalid&&valid;if(!valid||fieldsValidation.includes(true)){var loading=new literatum.FullPageLoading();loading.done();e.preventDefault();}else{var loading=new literatum.FullPageLoading();loading.setMessage("Do not close your browser while we are processing your payment");loading.start();}});},expand:function(e,widget){var $header=widget.find(".checkout-expand");$header.stop(true,true);$header.slideToggle();}};commerce.PaymentWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.PaymentWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.PaymentWidget.id);};commerce.PaymentWidget.prototype.registerListeners=function(){Object.getPrototypeOf(commerce.PaymentWidget.prototype).registerListeners.call(this);var widget=this;var $date=$(this.find("input[name='expireDate']"));$date.on('keyup',function(e){var thisVal=$(this).val();if(thisVal.length==0)
$(this).closest(".input-group").removeClass("focused");else
$(this).closest(".input-group").addClass("focused");var numChars=$(this).val().length;if(numChars===2){if(thisVal>12){thisVal=12;}
if(!/\//.test(thisVal)){thisVal+='/';}
$(this).val(thisVal);}
if(e.which==8&&numChars===2){thisVal=thisVal.substring(0,thisVal.length-2);$(this).val(thisVal);}});$date.on('blur',function(){var dateValue=$date.val().split('/');var numChars=$date.val().length;var thisVal=$date.val();if(this.value){$(widget.find("input[name='expYear']")).val(dateValue[1]);$(widget.find("input[name='expMonth']")).val(dateValue[0]);}else{$(widget.find("input[name='expYear']")).val("");$(widget.find("input[name='expMonth']")).val("");}
if(numChars>6){var currentDate=new Date();var currentYear=currentDate.getFullYear();var value=thisVal.split('/');var yearExpiry=value[1];var expireYear=parseInt(yearExpiry);}});$(this.find("#realNumber")).on("blur",function(e){var $value=$("#realNumber").val();var $cElement=$("#realNumber");var creditCard=commerce.validators.creditcard($value,$cElement);});$(this.find(".creditCarPayment .actions .primary")).on("click",function(e){var $form=widget.find("form[name='apg']");var $this=$('input[data-validate]');var $group=$this.closest(".input-group");var invalid=commerce.validators.validateField($this,$form);var notification=widget.getNotification($group.data('notification'));var $message=[];if($("#expYear").val()=="0000"){$message.push("year ");}
if($("#expMonth").val()=="00"){$message.push(" month");}
if($("#expMonth").val()=="00"&&$("#expYear").val()=="0000"){$message=$message.join("and");}
if($("#expMonth").val()!="00"&&$("#expYear").val()!="0000"){$message.push("a valid date");}
if(!notification){return;}
if(invalid){notification.reset();notification.setMessage('');notification.error();notification.show();}else{notification.reset()}
var inputContainer=$(".creditCarPayment .input-group");inputContainer.each(function(){var $cont=$(this);var $contError=$(this).find(".error");if($contError.length>0){if($contError.find(".invalid-cc").length===0&&!$cont.hasClass("credit-card-date-field")){$contError.find(".field-info").after("<div class='invalid-cc'>- IS MISSING</div>");}
else if($cont.hasClass("credit-card-date-field")){if($contError.find(".invalid-cc").length===0){$contError.find(".field-info").after("<div class='invalid-cc'>Please enter "+$message+"</div>");}
else{$contError.find(".invalid-cc").replaceWith("<div class='invalid-cc'>Please enter "+$message+"</div>");}}}
else{$cont.find(".invalid-cc").remove();}});});if(commerce.PaymentWidget.registerAdditionalListeners)
commerce.PaymentWidget.registerAdditionalListeners();};literatum.widgets.register(commerce.PaymentWidget);


commerce.PaymentWidget.registerAdditionalListeners=function(){$(document).ready(function(){var $confirmOrderMsg=$('.eCommerceCheckoutPaymentWidget .infoMsgBox');if($confirmOrderMsg.is(':visible')){$confirmOrderMsg[0].scrollIntoView();}
var userAgent=window.navigator.userAgent;if(userAgent.match(/iPad/i)||userAgent.match(/iPhone/i)){if($(".eCommerceCheckoutFieldsWidget .errorMsgBox").length>0&&!$(".checkout-expand > .errorMsgBox").hasClass("hidden")){$('body').animate({scrollTop:$(".checkout-expand > .errorMsgBox").offset().top},0);}
return;}
if($(".eCommerceCheckoutFieldsWidget .errorMsgBox").length>0&&!$(".checkout-expand > .errorMsgBox").hasClass("hidden")){$('html, body').animate({scrollTop:$(".checkout-expand > .errorMsgBox").offset().top},1000);}});};


commerce.PurchaseOptionsWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.savedItems);this.register(commerce.cart.buyingList);var $obj=this.find(".scroll-into-view").closest(".purchaseArea");if($obj&&$obj.length>0){setTimeout(()=>literatum.utils.scroll($obj,1000,50),500)
var $expandSection=this.find("*[data-bind='expandSection']");if($expandSection.length&&!$expandSection.hasClass('active')){$expandSection.click();}}};commerce.PurchaseOptionsWidget.prototype=new literatum.Widget();commerce.PurchaseOptionsWidget.id='eCommercePurchaseAccessWidget';commerce.PurchaseOptionsWidget.action='/pb/widgets/commerce/purchaseOptions';commerce.PurchaseOptionsWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.PurchaseOptionsWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.PurchaseOptionsWidget.id);};commerce.PurchaseOptionsWidget.binders={saveItem:function(e,widget){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();var key=$(this).attr("data-doi");commerce.cart.savedItems.saveByDoi(key);},addItem:function(e,widget){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();var key=$(this).attr("data-key");commerce.cart.buyingList.addItem(key);},expandSection:function(e,widget){e.preventDefault();widget.find('.purchaseAreaList_expanded').slideUp();widget.find('.purchaseAreaList_expand').attr("aria-expanded",false);if($(e.target).hasClass('active')){$(e.target).removeClass('active');$(e.target).siblings('.purchaseAreaList_expanded').slideUp();$(e.target).attr("aria-expanded",false);}else{$(e.target).addClass('active');widget.find(".purchaseAreaList_expand").not($(e.target)).removeClass('active');$(e.target).siblings('.purchaseAreaList_expanded').slideDown();$(e.target).attr("aria-expanded",true);}}};commerce.PurchaseOptionsWidget.prototype.update=function(model){this.triggerInfoHandlers(this,model);this.loaded();};commerce.PurchaseOptionsWidget.infoHandlers={info:function(message,widget,model){var key=model.attributes['itemAdded'];var notification=commerce.Notification.get(widget.find(".purchaseMessage[data-item='"+key+"'].info"));if(notification){notification.setMessage(message);notification.info();notification.show();notification.$element.siblings("a").find(".add-to-cart-msg").remove();setTimeout(function(){notification.$element.fadeOut();$(widget.find("*[data-entity='"+key+"']")).parent().hide();commerce.Notification.get(widget.find(".addedMessage[data-item='"+key+"']")).showFlex();},2000);}},error:function(message,widget,model){var key=model.attributes['itemAdded'];var notification=commerce.Notification.get(widget.find(".purchaseMessage[data-item='"+key+"']"));if(notification){notification.setMessage(message);notification.error();notification.show();}
$(widget.find("*[data-entity='"+key+"']")).hide();},savedItemInfo:function(message,widget){var notification=commerce.Notification.get(widget.find(".savedItem-info"));if(notification){notification.setMessage(message);notification.info();}
$(widget.find(".save-for-later-link")).hide();},savedItemError:function(message,widget){var notification=commerce.Notification.get(widget.find(".savedItem-info"));if(notification){notification.setMessage(message);notification.error();notification.show();}},nextAction:function(message){if(message=='refreshPage'){setTimeout(function(){location.reload();},5000);}}};literatum.widgets.register(commerce.PurchaseOptionsWidget);


commerce.CartIndicatorWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.buyingList);this.register(commerce.cart.savedItems);this.register("quantityIncreased");this.register("quantityDecreased");this.register("updateQuantity");};commerce.CartIndicatorWidget.prototype=new literatum.Widget();commerce.CartIndicatorWidget.id='eCommerceCartIndicatorWidget';commerce.CartIndicatorWidget.action=null;commerce.CartIndicatorWidget.prototype.update=function(model){var $cartSize=this.find("*[data-id='cart-size']");var count=Number(model.size)||0;var itemLabel=count===1?'item':'items';$cartSize.html('<span class="sr-only">Shopping cart with </span>'+'<span class="cart-count">'+count+'</span>'+'<span class="sr-only"> '+itemLabel+' </span>');if(count===0){$cartSize.addClass('sr-only').removeClass('hidden').css('display','');}else{$cartSize.removeClass('sr-only hidden').css('display','');}};commerce.CartIndicatorWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.CartIndicatorWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.CartIndicatorWidget.id);};literatum.widgets.register(commerce.CartIndicatorWidget);


commerce.AddToCartWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.buyingList);};commerce.AddToCartWidget.prototype=new literatum.Widget();commerce.AddToCartWidget.id='eCommerceCheckoutAddToCartWidget';commerce.AddToCartWidget.action='/pb/widgets/commerce/addToCart';commerce.AddToCartWidget.binders={expand:function(e,widget){e.preventDefault();if(widget.find(".add-journal-to-cart-container").length>0){var addToCart=document.createElement('div');$(addToCart).addClass('eCommerceCheckoutAddToCartWidgetExpanded');$(addToCart).appendTo('body');$('body').css('overflow','hidden');var closeButton='<a href="#" class="close float-right"><i class="icon-close_thin"></i></a>';widget.find(".add-journal-to-cart-container").clone().prepend(closeButton).appendTo(addToCart).slideToggle().find("a").first().focus();var overlay=document.createElement('div');$(overlay).addClass('overlay-fixed');$(overlay).appendTo('.eCommerceCheckoutAddToCartWidgetExpanded');$(overlay).find("a").first().focus();$(addToCart).find(".add-journal-to-cart-container.hidden").removeClass("hidden");}
widget.registerListeners();},addItem:function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();var key=$(this).attr("data-key");commerce.cart.buyingList.addItem(key);}};commerce.AddToCartWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.AddToCartWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.AddToCartWidget.id);};commerce.AddToCartWidget.infoHandlers={info:function(message,widget,model){var key=model.attributes['itemAdded'];var notification=commerce.Notification.get($(".eCommerceCheckoutAddToCartWidgetExpanded .purchaseMessage[data-item='"+key+"'].info"));if(notification){notification.setMessage(message);notification.info();notification.show();notification.$element.siblings("a").find(".add-to-cart-msg").remove();setTimeout(function(){notification.$element.fadeOut();$(".eCommerceCheckoutAddToCartWidgetExpanded *[data-entity='"+key+"']").hide();commerce.Notification.get(".addedMessage[data-item='"+key+"']").showFlex();},1000);}},error:function(message,widget,model){var key=model.attributes['itemAdded'];var notification=commerce.Notification.get($(".eCommerceCheckoutAddToCartWidgetExpanded .purchaseMessage[data-item='"+key+"'].error"));if(notification){notification.setMessage(message);notification.error();notification.show();}
$(".eCommerceCheckoutAddToCartWidgetExpanded *[data-entity='"+key+"']").hide();},savedItemInfo:function(message,widget){var notification=commerce.Notification.get(widget.find(".savedItem-info"));if(notification){notification.setMessage(message);notification.info();notification.show();}
$(".eCommerceCheckoutAddToCartWidgetExpanded .save-for-later-link").hide();},savedItemError:function(message,widget){var notification=commerce.Notification.get(widget.find(".savedItem-info"));if(notification){notification.setMessage(message);notification.error();notification.show();}},nextAction:function(message){if(message=='refreshPage'){setTimeout(function(){location.reload();},5000);}}};commerce.AddToCartWidget.prototype.render=function(model,params){params['doi']=this.find("a[data-doi]").attr("data-doi");Object.getPrototypeOf(commerce.AddToCartWidget.prototype).render.call(this,model,params);};commerce.AddToCartWidget.prototype.registerListeners=function(){Object.getPrototypeOf(commerce.AddToCartWidget.prototype).registerListeners.call(this);$(document).on('click',function(event){if(!$(event.target).closest('.eCommerceCheckoutAddToCartWidgetExpanded').length&&!$(event.target).closest('.eCommerceCheckoutAddToCartWidget').length&&$('.eCommerceCheckoutAddToCartWidgetExpanded').is(':visible')){event.preventDefault();$('.eCommerceCheckoutAddToCartWidgetExpanded').remove();$('body').css('overflow','auto');}});$(document).on('click','.eCommerceCheckoutAddToCartWidgetExpanded .close',function(){$('.eCommerceCheckoutAddToCartWidgetExpanded').remove();$('body').css('overflow','auto');});$(".eCommerceCheckoutAddToCartWidgetExpanded *[data-bind='addItem']").off();$(".eCommerceCheckoutAddToCartWidgetExpanded *[data-bind='addItem']").on("click",function(e){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();var key=$(this).attr("data-key");commerce.cart.buyingList.addItem(key);});};literatum.widgets.register(commerce.AddToCartWidget);


commerce.CartInfoWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.identity);this.register(commerce.cart.discounts);this.register(commerce.cart.buyingList);this.register(commerce.cart.savedItems);this.register(commerce.cart.billing);this.register(commerce.cart.shipping);};commerce.CartInfoWidget.prototype=new literatum.Widget();commerce.CartInfoWidget.id='eCommerceCartInfoWidget';commerce.CartInfoWidget.action=null;commerce.CartInfoWidget.prototype.update=function(){var notification=commerce.Notification.get(this.find(".cartInfo"));if(notification){notification.reset();}};commerce.CartInfoWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.CartInfoWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.CartInfoWidget.id);};literatum.widgets.register(commerce.CartInfoWidget);


commerce.IdentityBarWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.identity);};commerce.IdentityBarWidget.prototype=new literatum.Widget();commerce.IdentityBarWidget.id='literatumNavigationLoginBar';commerce.IdentityBarWidget.action='/pb/widgets/commerce/identityBar';commerce.IdentityBarWidget.binders={expand:function(e,widget){widget.find(".navigation-login-dropdown-container").toggle();}};commerce.IdentityBarWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.IdentityBarWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.IdentityBarWidget.id);};commerce.IdentityBarWidget.prototype.registerListeners=function(){Object.getPrototypeOf(commerce.RecommendedWidget.prototype).registerListeners.call(this);var $popups=$('.popup');var $popup=$('.login-popup');$('.show-login').off();$('.show-login').on("click",function(event){if($popups.length){$popups.addClass('hidden');$popup.removeClass('hidden');$('body').addClass('noscroll');$(".login-form form .login").trigger("focus");event.preventDefault();}});};literatum.widgets.register(commerce.IdentityBarWidget);


commerce.RestoreAccessWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);this.register(commerce.cart.restoreAccess);};commerce.RestoreAccessWidget.prototype=new literatum.Widget();commerce.RestoreAccessWidget.id='eCommerceRestoreContentAccessWidget';commerce.RestoreAccessWidget.action='/pb/widgets/commerce/restoreAccess';commerce.RestoreAccessWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.RestoreAccessWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.RestoreAccessWidget.id);};commerce.RestoreAccessWidget.binders={request:function(e,widget){var loading=new literatum.FullPageLoading();loading.start();commerce.cart.addCallback(loading.done);e.preventDefault();commerce.cart.restoreAccess.request(widget.find("input[name='email']").val());}};commerce.RestoreAccessWidget.prototype.update=function(model){this.triggerInfoHandlers(this,model);this.loaded();};commerce.RestoreAccessWidget.infoHandlers={restoreError:function(message,widget){widget.find('.restore-info').hide();widget.find('.restore-error').hide();var notification=commerce.Notification.get(widget.find(".restore-error"));notification.setMessage(message);notification.error();notification.show();},error:function(message,widget){widget.find('.restore-info').hide();var $inputGroup=widget.find("input[name='email']").closest(".input-group");var notification=commerce.FieldNotification.get($inputGroup);if(notification){notification.error();notification.setMessage(message);notification.show();}},info:function(message,widget){widget.find('.restore-error').hide();var $inputGroup=widget.find("input[name='email']").closest(".input-group");var notification=commerce.Notification.get(widget.find(".restore-info"));var fieldNotification=commerce.FieldNotification.get($inputGroup);if(fieldNotification){fieldNotification.reset();fieldNotification.hide();}
if(notification){notification.setMessage(message);notification.info();notification.show();}}};literatum.widgets.register(commerce.RestoreAccessWidget);


commerce.page.cart.checkoutButton=function(data){var $leftCol=$('.checkoutProcessLeftCol');if(data.size==0){$leftCol.removeClass('no-buying');}else{$leftCol.addClass('no-buying');}
if(data.size>0&&$(window).width()<993&&$('.checkoutStickyBtn').length==0&&$leftCol.length){$leftCol.append('<div><div class="checkoutStickyBtn"><input class="button primary" type="button" title="checkout" value="checkout"></div></div>');}
if(!data.size||$(window).width()>=993){$('.checkoutStickyBtn').remove();}};commerce.cart.register(commerce.cart.buyingList,commerce.page.cart.checkoutButton);commerce.cart.register(commerce.cart.savedItems,commerce.page.cart.checkoutButton);


$(function(){var checkout=location.hash.indexOf("checkout")>-1||location.href.indexOf('checkout')>-1;if(checkout&&$(".cartLabel .shopping-cart").html()>0){if(commerce.page.cart.show!==undefined){commerce.page.cart.show();}}
if(checkout){literatum.utils.nextCheckoutSection();}
if(commerce.page.cart.checkoutButton!==undefined)
commerce.page.cart.checkoutButton({size:$('.shopping-cart-indicator__badge .cart-count').html()});$(document).on('click','.add-journal-to-cart .prevent-fix, .add-journal-to-cart .tab-nav a',function(e){if($(this).parent().hasClass('disable-click')){return false;}else{$(this).next(".journal-options-expanded").slideToggle();$(this).toggleClass("open");setTimeout(function(){$('.eCommerceCheckoutSavedForLaterItemsWidget .journal-options-expanded,.eCommerceCheckoutRecommendedItemsWidget .journal-options-expanded,.eCommerceCheckoutRecentlyViewedItemsWidget .journal-options-expanded').each(function(){var expandedMargin=$(this).height()+21;if(expandedMargin>25&&$(this).is(':visible')){$(this).closest('.add-journal-to-cart').css('margin-bottom',expandedMargin);}else{$(this).closest('.add-journal-to-cart').css('margin-bottom','10px');}});},400);if($(this).closest('.purchaseArea').css('position')=='absolute'&&!$(e.target).closest('.tab-nav').length){$('.add-journal-to-cart').toggleClass('disable-click');$(this).closest('.add-journal-to-cart').toggleClass("disable-click");}}
return false;});verifyAddress();});function verifyAddress(){$(".eCommerceCheckoutFieldsWidget").on("focusout, blur","form .js__verifyAddress input",function(e){var input=$(this);var val=input.val();var POBoxPattern=new RegExp('^p.*o.*box.*','i');var isPoBoxString=val.match(POBoxPattern);var validPOBoxPattern=new RegExp('(?:p\\.?\\s*o\\.?|post(?:al|s)?\\s+office)\\s*(?:box)?\\s*(\\d+)','gim');if(isPoBoxString&&!val.match(validPOBoxPattern)){input.addClass("error");$("#poBoxError").removeClass("hidden")}else{input.removeClass("error");$("#poBoxError").addClass("hidden")}});}
if(commerce.page.cart.checkoutButton!==undefined){$(window).on("resize",function(){commerce.page.cart.checkoutButton({size:$('.shopping-cart-indicator__badge .cart-count').html()});});}
literatum.events.register('user-action',function(){literatum.widgets.all().forEach(function(item){item.reset()});});literatum.events.register('widget-rendered',function(){var $document=$(document);if(typeof $document.Tabs!='undefined'){$(document).Tabs();}});commerce.cart.setErrorHandler(function(){location.reload();});


$(function(){$(".commerceExplainer .header").on("click",function(){$header=$(this);$content=$header.next();$content.slideToggle(function(){if($("li",$content).length==0)
return;if($content.is(":visible")){$header.removeClass("collapsed");$header.addClass("expanded")}else{$header.removeClass("expanded");$header.addClass("collapsed");}});});$(".commerceExplainer .content").each(function(index,element){if($("li",element).length==0){$(element).closest(".container").children(".header").addClass("empty expanded");}});});


commerce.RedeemAllowanceWidget=function(widgetDef,element){literatum.Widget.call(this,widgetDef,element);};commerce.RedeemAllowanceWidget.prototype=new literatum.Widget();commerce.RedeemAllowanceWidget.id='eCommerceRedeemOfferWidget';commerce.RedeemAllowanceWidget.action='/pb/widgets/commerce/redeemAllowance';commerce.RedeemAllowanceWidget.binders={expand:function(e,widget){e.preventDefault();widget.find('.expand-purchase-options').toggleClass('expanded');widget.find(".add-allowance").slideToggle();}};commerce.RedeemAllowanceWidget.find=function(){var $result=$("*[data-widget-def='"+commerce.RedeemAllowanceWidget.id+"']");if($result.length>0){return $result;}
return $("."+commerce.RedeemAllowanceWidget.id);};literatum.widgets.register(commerce.RedeemAllowanceWidget);

;


$(function(){$('.password-eye-icon').each(function(){var $eye=$(this);var $group=$eye.closest('.input-group');var $input=$group.find('input');$eye.toggleClass('hidden',!$input.val());$input.on('input',function(){$eye.toggleClass('hidden',!$input.val());});$eye.on("click",function(){$eye.toggleClass('icon-eye-blocked');if($eye.hasClass('icon-eye-blocked')){$eye.removeClass('icon-eye');$input.prop('type','text');}else{$eye.addClass('icon-eye');$input.prop('type','password');}});});if($(".checkoutDropZone").length>0){$(".item__removal__popup__text").addClass("item__removal__cart__text");$(".item__removal__cart__text").removeClass("item__removal__popup__text");if($(".item__removal__cart__text").length>0){$(".item__removal__cart__text").clone().prependTo($(".checkoutDropZone").closest(".row").parent());$(".item__removal__cart__text").last().remove();}}
setTimeout(function(){$(".item__removal__popup__text").fadeOut("slow");},4000);});$(document).ready(function(){$(".js__mail_verification_widget input").on("keyup",function(){if($(this).val().trim().length>0){$(this).closest("form").find(".form-btn").addClass("blue-subb-btn");$(this).closest("form").find(".form-btn").prop('disabled',false);}else{$(this).closest("form").find(".form-btn").removeClass("blue-subb-btn");$(this).closest("form").find(".form-btn").prop('disabled',true);}});$(".raa-modal-dialog .raa-modal-dialog-cncl").on("click",function(e){e.preventDefault();$(this).closest(".raa-modal-dialog").hide();});$(".raa-modal-dialog.enabled").show();var $drawer=$('.emails-wrappers,.phones-wrappers');$drawer.on('click','.make-primary,.remove',function(e){$(".js__profileForm input[type='submit']").prop("disabled",false);e.preventDefault();});$(document).on("keypress change",".js__profileForm input, .js__profileForm select",function(e){if($(this).val()){$(".js__profileForm input[type='submit']").prop("disabled",false);}else{$(".js__profileForm input[type='submit']").prop("disabled",true);}});function guestEmail(email){var emailForm=/^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;return emailForm.test(email);}
$("#email").on('keyup change',function(){if(guestEmail($("#email").val())&&$("#taggedNoGuest").val()=="true"){$(".checkoutMethod input.primary").removeAttr("disabled");}
else{$(".checkoutMethod input.primary").attr("disabled","true");}})});(function($){function visible(element){return $.expr.filters.visible(element)&&!$(element).parents().addBack().filter(function(){return $.css(this,'visibility')==='hidden';}).length;}
function focusable(element,isTabIndexNotNaN){var map,mapName,img,nodeName=element.nodeName.toLowerCase();if('area'===nodeName){map=element.parentNode;mapName=map.name;if(!element.href||!mapName||map.nodeName.toLowerCase()!=='map'){return false;}
img=$('img[usemap=#'+mapName+']')[0];return!!img&&visible(img);}
return(/input|select|textarea|button|object/.test(nodeName)?!element.disabled:'a'===nodeName?element.href||isTabIndexNotNaN:isTabIndexNotNaN)&&visible(element);}
$.extend($.expr.pseudos[':'],{focusable:function(element){return focusable(element,!isNaN($.attr(element,'tabindex')));}});})(jQuery);


var passwordStrengthIndicator={};$(function(){var lower=/[a-z]/;var upper=/[A-Z]/;var special=/[!@#\$%\^\&*\)\(+=._-]/;var numeric=/[0-9]/;passwordStrengthIndicator.getBaseScore=function(value){var score=0;if(lower.test(value)){score++;}
if(upper.test(value)){score++;}
if(special.test(value)){score++;}
if(numeric.test(value)){score++;}
if(score===1){score=0;}
return score;};passwordStrengthIndicator.updateIndicator=function($indicator,value,min,max,target){var too__short=$indicator.find('.too-short').text();var strong=$indicator.find('.strong').text();var weak=$indicator.find('.weak').text();var too__long=$indicator.find('.too-long').text();$indicator.removeClass('too-short too-long weak strong');var pass_selector=$indicator.siblings('.pass-strength-popup');pass_selector.removeClass('too-short too-long weak strong');if(!value){pass_selector.find('.strength').hide();return;}
var length=value.trim().length;if(length<min){$indicator.addClass('too-short');pass_selector.addClass('too-short');pass_selector.find('.strength').text(too__short).show();return;}
if(length>max){$indicator.addClass('too-long');pass_selector.addClass('too-long');pass_selector.find('.strength').text(too__long).show();return;}
var score=passwordStrengthIndicator.getBaseScore(value);if(score<target){$indicator.addClass('weak');pass_selector.addClass('weak');pass_selector.find('.strength').text(weak).show();}else{$indicator.addClass('strong');pass_selector.addClass('strong');pass_selector.find('.strength').text(strong).show();}};$('.password-strength-indicator').each(function(){if(!$('.pass-hint').length){var $indicator=$(this);var $group=$indicator.closest('.input-group');var $input=$group.find('input');var data=$indicator.data();var min=data.min;var max=data.max;var strength=data.strength;passwordStrengthIndicator.updateIndicator($indicator,$input.val(),min,max,strength);$input.on('input change',function(){passwordStrengthIndicator.updateIndicator($indicator,$input.val(),min,max,strength);});}});if($('.pass-hint')){$('.pass-hint').on('keyup input focus change',function(){var pswd=$(this).val();var $indicator=$(this).siblings('.password-strength-indicator');var pswd_req=$indicator.data('strength');var pswd_length=$indicator.data('min');var pswd_max=$indicator.data('max');if(!pswd_req){pswd_req=3;}
passwordStrengthIndicator.updateIndicator($indicator,pswd,pswd_length,pswd_max,pswd_req);var $validator=$(this).siblings('.js__pswd_info');if(pswd.match(lower)){$validator.find('#letter').addClass('valid');}else{$validator.find('#letter').removeClass('valid');}
if(pswd.match(upper)){$validator.find('#capital').addClass('valid');}else{$validator.find('#capital').removeClass('valid');}
if(pswd.match(special)){$validator.find('#special').addClass('valid');}else{$validator.find('#special').removeClass('valid');}
if(pswd.match(numeric)){$validator.find('#number').addClass('valid');}else{$validator.find('#number').removeClass('valid');}
if($validator.find('.valid').length>=pswd_req&&pswd.length<=pswd_max&&pswd.length>=pswd_length)
$validator.fadeOut('slow');else
$validator.fadeIn('slow');}).on("blur",function(){$('.js__pswd_info').fadeOut('fast');});}});


$(function(){var $confirmation=$('.registration-confirmation');var selectedLang=$('html').attr('lang');$confirmation.on('click','.resend',function(){event.preventDefault();$.ajax({method:'get',url:$(this).attr('href')+'&ajaxRequest=true',xhrFields:{withCredentials:true}}).then(function(){if(selectedLang==='en')
$confirmation.html('A link has been resent to your email');else if(selectedLang==='es')
$confirmation.html('Hemos enviado nuevamente el enlace a su email');}).fail(function(){if(selectedLang==='en')
$confirmation.html('An error has occurred');else if(selectedLang==='es')
$confirmation.html('Se ha producido un error');});});var $popup=$('.societyID-popup');$popup.delay(5000).hide(0);$popup.on('click','.close',function(){$popup.addClass('hidden');});});


$(function(){$('.request-username-form').each(function(){var $form=$(this);var $email=$form.find('.email');var $submit=$form.find('.submit');var change=function(){if(!$email.val()){$submit.attr('disabled',true);}else{$submit.prop('disabled',false);}};$email.on('keyup input',change);change();$form.on("submit",function(event){if($submit.attr('disabled')){event.preventDefault();}});});});


$(function(){var $popups=$('.popup');var $popup=$('.login-popup');var $login=$popup.find('.login');var $password=$popup.find('.password');var $eye=$popup.find('.password-eye-icon');var $remember=$popup.find('.remember .cmn-toggle');var $message=$popup.find('.message');var $submit=$popup.find('.submit');var items=$popup.find('a, button, input');var lastItem,revers=false,tabKey=9,shift=16,$close=$popup.find('.close');items.each(function(index){if(index===items.length-1){lastItem=$(this);}});$popup.on('keydown',function(e){if(e.keyCode===shift){revers=true;}
if((e.keyCode||e.which)===tabKey){if(!revers){tabEvent();}else{tabRevers();}}});$('.show-login:not(.userLoginBar__controller)').on("click",function(event){$popups.addClass('hidden');$popup.removeClass('hidden');$('body').addClass('noscroll');event.preventDefault();if(UX&&UX.trapFocus){UX.trapFocus($popup).wait(100).then(function(focusTrap){$popup.data("focusTrap",focusTrap.init($popup.find('#login')));});}});$('.redicrect__close').on("click",function(){$('.redirect__modal .close').trigger("click");});$popup.on('click','.close',function(e){e.preventDefault();$('body').removeClass('noscroll');$popup.addClass('hidden');$eye.addClass('hidden icon-eye').removeClass('icon-eye-blocked');$submit.attr('disabled',true);$remember.attr('checked',false);$login.val('');$password.val('');$message.html('');if($popup.data("focusTrap")){$popup.data("focusTrap").destroy();$popup.data('focusTrap',undefined);}});$(document).on('keyup',$popup,function(e){if(e.keyCode==27){$popup.find('.close').trigger("click");}
if(e.keyCode===shift){revers=false;}});function tabEvent(){$close.off();lastItem.on('focusout',function(){$close.trigger("focus");});}
function tabRevers(){lastItem.off();$close.on('focusout',function(){lastItem.trigger("focus");});}});


$(function(){jcf.setOptions('Select',{"wrapNativeOnMobile":false});jcf.replace('.literatumProfileMainWidget .select select:not([multiple="multiple"])');if($(window).width()<992){var $select=$('select[multiple="multiple"]');$select.each(function(){var $this=$(this);var $taxonomy=$this.attr('id').split('.');var $taxonomyCode=$('[name="'+$taxonomy[0]+'.code"]');var $maxTags=$taxonomyCode.data('maxtags').split('.');$maxTags=$maxTags[0];$this.chosen({max_selected_options:$maxTags});});}
$(function(){var $registrationForm=$('[action="/action/registration"]');if($registrationForm.length){$registrationForm.find('.label.error').first().next('input').trigger("focus");}});});


$(function(){var pattern=/^([\w-+]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,9}(?:\.[a-z]{2})?)$/i;$('.loginInformation').each(function(){var $form=$(this);var $email=$form.find('.email');var $email2=$form.find('.email2');var change=function(){$(this).prevAll('.label').removeClass('error').find('.message').remove();};var blur=function(){var $email=$(this);if($email.val()&&!pattern.test($email.val())){var $label=$email.prevAll('.label');$label.addClass('error');var $message=$label.find('.message');var $lang_selector=$(".literatumLocaleChanger .language");var error=" Is Invalid";if($lang_selector!=null){if($lang_selector.text()==="ESP"||$lang_selector.text()===""){error=" Is Invalid";}
else{error="Información inválida";}}
if(!$message.length){$message=$('<span class="message"></span>').appendTo($label);}
$message.html('<span> - </span> '+error)}};$email.on('blur',blur).on('change',change);$email2.on('blur',blur).on('change',change);});});


$(function(){var $popups=$('.popup');var $popup=$('.registration-popup');var $email=$popup.find('.email');var $submit=$popup.find('.submit');var items=$popup.find('a, button, input');var lastItem,revers=false,tabKey=9,shift=16,$close=$popup.find('.close');items.each(function(index){if(index===items.length-1){lastItem=$(this);}});$popup.on('keydown',function(e){if(e.keyCode===shift){revers=true;}
if((e.keyCode||e.which)===tabKey){if(!revers){tabEvent();}else{tabRevers();}}});$('.show-registration').on("click",function(event){$popups.addClass('hidden');$popup.removeClass('hidden');$popup.find('input[type="text"]').trigger("focus");event.preventDefault();});$popup.on('click','.close',function(e){e.preventDefault();$popup.addClass('hidden');$('body').removeClass('noscroll');});$popup.on('keyup',function(e){if(e.keyCode==27){$popup.find('.close').trigger("click");}
if(e.keyCode===shift){revers=false;}});var pattern=/^([\w-+]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,9}(?:\.[a-z]{2})?)$/i;var change=function(event){var code=event.keyCode?event.keyCode:event.which;if(code==13){return;}
$email.prevAll('.label').removeClass('error').find('.message').remove();if(!$email.val()){$submit.attr('disabled',true);}else{$submit.prop('disabled',false);}};$submit.on("click",function(){if(!$email.val()){return false;}else if(!pattern.test($email.val())){var $label=$email.prevAll('.label');$label.addClass('error');var $message=$label.find('.message');if(!$message.length){$message=$('<span class="message"></span>').appendTo($label);}
$message.html('<span> - </span> Is Invalid')
return false;}});var blur=function(){if($email.val()&&!pattern.test($email.val())){var $label=$email.prevAll('.label');$label.addClass('error');var $message=$label.find('.message');if(!$message.length){$message=$('<span class="message"></span>').appendTo($label);}
$message.html('<span> - </span> Is Invalid')}};function tabEvent(){$close.off();lastItem.on('focusout',function(){$close.trigger("focus");});}
function tabRevers(){lastItem.off();$close.on('focusout',function(){lastItem.trigger("focus");});}
$email.on('keyup input',change);$email.on('blur',blur);});


$(function(){$('.request-reset-password-form').each(function(){var $form=$(this);var $email=$form.find('.email');var $submit=$form.find('.submit');var change=function(){if(!$email.val()){$submit.attr('disabled',true);}else{$submit.prop('disabled',false);}};$email.on('keyup input',change);change();$form.on("submit",function(event){if($submit.attr('disabled')){event.preventDefault();}});});});$(document).ready(function(){var $drawer=$('.emails-wrappers,.phones-wrappers');$drawer.on('click','.make-primary,.remove',function(e){$(".js__profileForm input[type='submit']").prop("disabled",false);e.preventDefault();});$(document).on("keypress change",".js__profileForm input, .js__profileForm select",function(e){if($(this).val()){$(".js__profileForm input[type='submit']").prop("disabled",false);}else{$(".js__profileForm input[type='submit']").prop("disabled",true);}});});


$(function(){var $drawers=$('.top-drawer');var $drawer=$('.request-reset-password-drawer');var $content=$drawer.find('.content');var $form=$content.find('form');var $email=$form.find('.email');var $submit=$form.find('.submit');var $original=$content.find('.form');var $success=$content.find('.success-template');var $message=$content.find('.message');var $recaptcha=$content.find('.g-recaptcha');var $subHeader=$content.find('.sub');var id;$('.show-request-reset-password').on("click",function(event){$subHeader.removeClass('hidden');$drawers.addClass('hidden');$drawer.removeClass('hidden');$success.addClass('hidden');if($recaptcha.length&&typeof grecaptcha!=='undefined'){if(typeof id!=='undefined'){grecaptcha.reset(id);}else{id=grecaptcha.render($recaptcha[0],$recaptcha.data());}}else if($content.find(".LBD_CaptchaDiv").length){$content.find(".LBD_CaptchaDiv").find(".LBD_ReloadLink").trigger("click");}
$original.removeClass('hidden');$content.slideDown('fast');$content.find(":focusable").first().trigger("focus");event.preventDefault();});$drawer.on('click','.cancel',function(event){$content.slideUp('fast');$message.html('');$email.val('');$submit.attr('disabled',true);$drawer.addClass('hidden');event.preventDefault();$drawer.find('.password-recaptcha-ajax').empty();$('.login-popup').find(":focusable").first().trigger("focus");if($drawer.hasClass('hidden')){$('a').attr('tabindex','0');$('input').attr('tabindex','0');if($('.top-header-menu-btn'))
$('.top-header-menu-btn').attr("tabindex","0");}});$drawer.on('keyup',function(e){if(e.keyCode==27){$drawer.find('.cancel').trigger("click");}});$form.on("submit",function(event){event.preventDefault();if(!$email.val()){return;}
var url=$form.attr('action');var data=$form.serializeArray();data.push({name:'format',value:'json'});$.ajax({method:'post',url:url,data:data,xhrFields:{withCredentials:true}}).then(function(data){if(data.result){$original.removeClass('hidden');$success.addClass('hidden');$message.html(data.message);if($recaptcha.length&&typeof grecaptcha!=='undefined'){if(typeof id!=='undefined'){grecaptcha.reset(id);}else{id=grecaptcha.render($recaptcha[0],$recaptcha.data());}}else if($content.find(".LBD_CaptchaDiv").length){$content.find(".LBD_CaptchaDiv").find(".LBD_ReloadLink").trigger("click");}}else if(data.externalLink){window.location.replace(data.externalLink);}else{$original.addClass('hidden');$subHeader.addClass('hidden');$success.removeClass('hidden');}}).fail(function(){$original.removeClass('hidden');$success.addClass('hidden');$message.html('Unknown error');});});});


$(function(){var $body=$('body');var $drawers=$('.top-drawer');var $drawer=$('.request-username-drawer');var $content=$drawer.find('.content');var $form=$content.find('form');var $email=$form.find('.email');var $submit=$form.find('.submit');var $original=$content.find('.form');var $success=$content.find('.success-template');var $message=$content.find('.message');var $recaptcha=$content.find('.g-recaptcha');var id;$('.show-request-username').on("click",function(event){$drawers.addClass('hidden');$drawer.removeClass('hidden');$success.addClass('hidden');if($recaptcha.length&&typeof grecaptcha!=='undefined'){if(typeof id!=='undefined'){grecaptcha.reset(id);}else{id=grecaptcha.render($recaptcha[0],$recaptcha.data());}}else if($content.find(".LBD_CaptchaDiv").length){$content.find(".LBD_CaptchaDiv").find(".LBD_ReloadLink").trigger("click");}
$original.removeClass('hidden');$content.slideDown('fast');$content.find(":focusable").first().trigger("focus");event.preventDefault();});$drawer.on('click','.cancel',function(event){$content.slideUp('fast');$message.html('');$email.val('');$submit.attr('disabled',true);$drawer.addClass('hidden');event.preventDefault();$('.login-popup').find(":focusable").first().trigger("focus");});$drawer.on('keyup',function(e){if(e.keyCode==27){$drawer.find('.cancel').trigger("click");}});$email.on('keyup input',function(){if(!$email.val()){$submit.attr('disabled',true);}else{$submit.prop('disabled',false);}});$form.on("submit",function(event){event.preventDefault();if(!$email.val()){return;}
var url=$form.attr('action');var data=$form.serializeArray();data.push({name:'ajaxRequest',value:true});$.ajax({method:'post',url:url,data:data,xhrFields:{withCredentials:true}}).then(function(data){if(data.result){$original.removeClass('hidden');$success.addClass('hidden');$message.html(data.message);if($recaptcha.length&&typeof grecaptcha!=='undefined'){if(typeof id!=='undefined'){grecaptcha.reset(id);}else{id=grecaptcha.render($recaptcha[0],$recaptcha.data());}}else if($content.find(".LBD_CaptchaDiv").length){$content.find(".LBD_CaptchaDiv").find(".LBD_ReloadLink").trigger("click");}}else{$original.addClass('hidden');$success.removeClass('hidden');}}).fail(function(){$original.removeClass('hidden');$success.addClass('hidden');$message.html('Unknown error');});});});


$(function(){$('.resetPasswordWidget').each(function(){var $form=$(this).find('form');var $password=$form.find('.password');var $submit=$form.find('.submit');var change=function(){var valid=true;$password.each(function(){if(!$password.val())
valid=false;});if(!valid){$submit.attr('disabled',true);}else{$submit.prop('disabled',false);}};$password.on('keyup input',change);change();$form.on("submit",function(event){if($submit.attr('disabled')){event.preventDefault();}});});});


$(function(){$('.claim-options li').each(function(){var $form=$(this).find('form');var $token=$form.find('.token');var $submit=$form.find('.submit');var change=function(){if(!$token.val()){$submit.attr('disabled',true);}else{$submit.prop('disabled',false);}};$token.on('keyup input',change);change();$form.on("submit",function(event){if($submit.attr('disabled')){event.preventDefault();}});});});


$(function(){var $drawers=$('.top-drawer');var $drawer=$('.change-password-drawer');var $content=$drawer.find('.content');var $form=$content.find('form');var $old=$form.find('.old');var $new=$form.find('.new');var $message=$form.find('.message');var $submit=$form.find('.submit');var $original=$content.find('.form');var $success=$content.find('.success-template');var $indicator=$content.find('.password-strength-indicator');var $eye=$content.find('.password-eye-icon');$('.show-change-password').on("click",function(event){$drawers.addClass('hidden');$drawer.removeClass('hidden');$success.addClass('hidden');$original.removeClass('hidden');$content.slideDown('fast');$content.find("input:focusable").first().trigger("focus");event.preventDefault();});$drawer.on('click','.cancel',function(event){$content.slideUp('fast');$old.attr('type','password').val('');$new.attr('type','password').val('');$indicator.removeClass('too-short too-long weak medium strong very-strong');$eye.addClass('hidden icon-eye').removeClass('icon-eye-blocked');$message.text('');$submit.attr('disabled',true);$drawer.addClass('hidden');if($drawer.hasClass('hidden')){$('a').attr('tabindex','0');$('input').attr('tabindex','0');if($('.top-header-menu-btn'))
$('.top-header-menu-btn').attr("tabindex","0");}
event.preventDefault();});var indicatorClassesCheck='.too-short, .too-long, .weak';if($($submit).hasClass('passRankDisabled')){indicatorClassesCheck='.too-short, .too-long';}
var change=function(){if(!$old.val()||!$new.val()||$indicator.is(indicatorClassesCheck)){$submit.attr('disabled',true);}else{$submit.prop('disabled',false);}};$old.on('keyup input',change);$new.on('keyup input',change);$form.on("submit",function(event){event.preventDefault();if(!$old.val()||!$new.val()){return;}
var url=$form.attr('action');var data=$form.serializeArray();data.push({name:'ajaxRequest',value:true});$.ajax({method:'post',url:url,data:data,xhrFields:{withCredentials:true}}).then(function(data){if(data.result){$original.removeClass('hidden');$success.addClass('hidden');$message.html(data.message);}else{$original.addClass('hidden');$success.removeClass('hidden');}}).fail(function(){$original.removeClass('hidden');$success.addClass('hidden');$message.html('Unknown error');});});});


$(function(){var $drawers=$('.top-drawer');var $drawer=$('.verify-phone-drawer');var $content=$drawer.find('.content');var $form=$content.find('form');var $verificationCode=$form.find('.verificationCode');var $message=$form.find('.message');var $submit=$form.find('.submit');var $original=$content.find('.form');var $success=$content.find('.success-template');$('.show-verify-phone').on("click",function(event){var $link=$(this);var link=$link.attr('href')
$.ajax(link).then(function(data){if(data.result){$original.removeClass('hidden');$success.addClass('hidden');$message.html(data.message);}else{$drawer.removeClass('hidden');$success.addClass('hidden');$original.removeClass('hidden');$content.slideDown('fast');}});event.preventDefault();});$drawer.on('click','.cancel',function(event){$content.slideUp('fast');$verificationCode.attr('type','text').val('');$message.text('');$submit.attr('disabled',true);$drawer.addClass('hidden');event.preventDefault();});var change=function(){if(!$verificationCode.val()){$submit.attr('disabled',true);}else{$submit.prop('disabled',false);}};$verificationCode.on('keyup input',change);$form.on("submit",function(event){var reg=new RegExp('^[0-9]{6}$');event.preventDefault();if(!reg.test($verificationCode.val())){$original.removeClass('hidden');$success.addClass('hidden');$message.html('verification code must be 6 digits');return;}
var url=$form.attr('action');var data=$form.serializeArray();data.push({name:'ajaxRequest',value:true});$.ajax({method:'post',url:url,data:data,xhrFields:{withCredentials:true}}).then(function(data){if(data.result){$original.removeClass('hidden');$success.addClass('hidden');$message.html(data.message);}else{$original.addClass('hidden');$success.removeClass('hidden');}}).fail(function(){$original.removeClass('hidden');$success.addClass('hidden');$message.html('Unknown error');});});});


$(function(){var start=1000;var $emails=$('.emails-wrappers');if(!$emails.length)return;var current=$emails.data().count;var max=$emails.data().max;var $drawers=$('.top-drawer');var $drawer=$('.emails-wrappers .verification-confirmation');var $content=$drawer.find('.content');var $success=$drawer.find('.success-template');var $failure=$drawer.find('.failure-template');var template=$emails.find('.template').html();$emails.on('click','.add',function(e){e.preventDefault();if(current<max){$emails.append(template.replace(/INDEX/g,start++));current++;$emails.toggleClass('saturated',current>=max);}});$emails.on('click','.remove',function(e){e.preventDefault();$(this).closest('.email').remove();current--;$emails.toggleClass('saturated',current>=max);});$emails.on('click','.make-primary',function(){var $old=$emails.find('.email.primary').find('.value');var $new=$(this).closest('.email').find('.value');var value=$new.val();$new.val($old.val());$old.val(value);});$emails.on('click','.resend-verification',function(event){event.preventDefault();$.ajax({method:'get',url:$(this).attr('href')+'&ajaxRequest=true',xhrFields:{withCredentials:true}}).then(function(data){var $clone;if(data.result){$clone=$failure.clone();$clone.find('.message').html(data.message);}else{$clone=$success.clone();}
$content.html($clone.html());$drawers.addClass('hidden');$drawer.removeClass('hidden');$content.slideDown('fast');});});$drawer.on('click','.cancel',function(event){$content.slideUp('fast');$drawer.addClass('hidden');event.preventDefault();});});


$(function(){var start=1000;var $phones=$('.phones-wrappers');if(!$phones.length)return;var current=$phones.data().count;var max=$phones.data().max;var template=$phones.find('.template').html();$phones.on('click','.add',function(){if(current<max){$phones.append(template.replace(/INDEX/g,start++));current++;$phones.toggleClass('saturated',current>=max);}});$phones.on('click','.remove',function(){$(this).closest('.phone').remove();current--;$phones.toggleClass('saturated',current>=max);});});


$(function(){$('.addresses').each(function(){var $widget=$(this);var $change=$widget.find('.switch-address');var $edit=$widget.find('.edit');var $addresses=$widget.find('.address');var clear=function(){$edit.find('.dynamic').val('');$edit.find('.error').removeClass('error');$edit.find('.state').attr('disabled',true);$edit.find('.state').closest('.input-group').addClass('hidden');$edit.find('.message').text('');};$change.on("change",function(){var uuid=$change.val();$edit.addClass('hidden');$addresses.addClass('hidden');clear();if(uuid){$addresses.filter('.'+uuid).removeClass('hidden');}else{$edit.removeClass('hidden');}});$widget.on('click','.edit-address',function(e){e.preventDefault();var $address=$(this).closest('.address');$address.find('[data-name]').each(function(){var $this=$(this);var $holder=$edit.find('#address\\.'+$this.data().name);var text=$this.text();if($holder.is('select')){console.log($holder.find('option').filter(function(){return $(this).val()==text||$(this).text()==text;}));$holder.find('option').removeAttr('selected').filter(function(){return $(this).val()==text||$(this).text()==text;}).prop('selected',true);}else{$holder.val(text);}});var country=$edit.find('.country').val();if(country){$edit.find('.state').addClass('hidden');var $states=$edit.find('.state.'+country);if($states.length){var state=$address.find('[data-name="state"]').text();$states.find('option').removeAttr('selected').filter(function(){return $(this).val()==state||$(this).text()==state;}).prop('selected',true);$states.prop('disabled',false);$states.closest('.input-group').removeClass('hidden');$states.removeClass('hidden');}}
$address.addClass('hidden');$edit.removeClass('hidden');});$(".save-profile").on("click",function(){var $editAddress=$(".edit-address");if($editAddress.is(':hidden')){return}
$editAddress.trigger("click");$(".edit").addClass("hidden");$(".address").removeClass("hidden");});$widget.on('change','.country',function(){var value=$(this).val();var $states=$edit.find('.state');$states.attr('disabled',true).val('');$states.addClass('hidden');var $current=$states.filter('.'+value);if($current.length){$current.prop('disabled',false);$current.removeClass('hidden');}
$states.closest('.input-group').toggleClass('hidden',!$current.length);});});});


$(function(){$('.social-email').each(function(){var $social=$(this);var $submit=$social.find('.submit');var change=function(){if($social.find('.required').filter(function(){return!$(this).val();}).length>0){$submit.attr('disabled',true);}else{$submit.prop('disabled',false);}};$social.find('.required').on('keyup input',change);change();});});


$(function(){var $section=$('.institutions');var $search=$section.find('.search');var toggle=function($link,value){$link.find('a').toggleClass('collapsed',!value);$link.next().toggleClass('hidden',value);};$search.on("keyup",function(){var text=$(this).val().toLowerCase();$section.find('.expand-link').each(function(){toggle($(this),!text);});$section.find('.institution').each(function(){var $institution=$(this);$institution.toggleClass('hidden',$institution.data().value.toLowerCase().indexOf(text)<0);});$section.find('.federation').each(function(){var $federation=$(this);$federation.toggleClass('hidden',!$federation.find('.institution:not(.hidden)').length);});});$section.on('click','.expand-link',function(event){var collapsed=$(this).next().hasClass("hidden");event.preventDefault();toggle($(this),!collapsed);});$('#openLearnMorePopup').on("click",function(){$('#learnMorePopup').dialog({modal:true,width:'425px'});});if(!isLocalStorageAvailable()){$('.institution-preference-userconsent-checkbox').prop('checked',false);$('.local-storage-prevent').css("display","block");}
$('.icon-close').on("click",function(){$('.local-storage-prevent').css("display","none");});});function isLocalStorageAvailable(){var test='test';try{localStorage.setItem(test,test);localStorage.removeItem(test);return true;}catch(e){return false;}}
$(function(){shibbolethInitSearch();});function loseFocus(){$('#shibboleth_search').trigger('blur')}
function shibbolethInitSearch(){var $el=$('#shibboleth_search');var $bottomSection=$('.center-aligned');var $remoteLoginForm=$('.login-form.remote')
var placeholder='Type the name of your institution';var userIndicator=placeholder;var $lang_selector=$(".language-switcher li .sr-only");if($lang_selector.text()==="German Language is activeswitch to English language"){placeholder='Bitte geben Sie den Namen Ihrer Institution ein';userIndicator=placeholder}
else if($("html").attr("lang")==="de"){placeholder='Geben Sie den Namen Ihrer Institution ein';userIndicator=placeholder}else if($("html").attr("lang")==="no"){placeholder='Tast inn navnet på organisasjonen din';userIndicator=placeholder}
if($el.length){var searchViaFederation=$el.data('search-via-federation-text')||'You can search for your Institution via Federation ';var ms=$el.magicSuggest({allowFreeEntries:false,data:'/pb/widgets/shibbolethLogin/institutions',dataUrlParams:{"redirectUrl":window.location.search.indexOf("redirectUri")!==-1?location.search.match(/\?redirectUri=([^&]*)/)[1]||"":''},hideTrigger:true,maxSelection:1,method:'get',minChars:1,mode:'remote',minCharsRenderer:function(v){extraMSContent();},noSuggestionText:'<div class="ms-empty-res">'+'<h4>We couldn’t find any result for '+'<em>{{query}}</em>'+'</h4>'+'<p>'+searchViaFederation+'<a href="/action/ssostart?viaFederation=true">here</a>'+'</p>'+'</div>',placeholder:placeholder,resultsField:'name',renderer:function(data){if(data){return'<a data-entityid="'+data.entityId+'" data-name="'+data.federationName+'" '+'class="sso-institution" href="'+data.institutionUrl+'">'+
data.name+'</a>';}}});$(function(){setTimeout(function(){var inputElement=$(".institutional--select").find('input');if(inputElement.length>0){inputElement.attr('aria-label','type your institution name');}},0);});var closeButton=function(){return'<img id="msBlur" class="msCloseButton" src="/templates/jsp/images/close.svg"/>'};var extraMSContent=function(){ms.helper.html(userIndicator);ms.helper.addClass('visible');ms.helper.show();};function renderRecentInstitutionView(item){var recentlyLoggednIn='<div class="ms-org-row">'+'<a  href="'+item.recentURL+'">'+
item.recentName+'</a>'+'<button type="button" data-item-id="'+item.recentID+'" class="ms-org-remove"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.666 1.276L8.723.333 5 4.056 1.276.333l-.943.943L4.056 5 .333 8.723l.943.943L5 5.943l3.723 3.723.943-.943L5.943 5l3.723-3.724z" fill="#757575"/></svg></button> '+'</div>';ms.helper.find(".ms-recently-logged").append(recentlyLoggednIn);}
$(".institutional--select").on("click",".ms-org-remove",function(e){e.preventDefault();var el=$(this).closest(".ms-org-row");var id=$(this).data("item-id");$(this).hide();el.append("<div class='loader'></div>");$.ajax({url:'/pb/widgets/shibbolethLogin/removeRecentInstitution',type:"GET",data:{"recentID":id},success:function(){el.remove();}})});var hideExtraMSContent=function(){ms.helper.html('');ms.helper.removeClass('visible');};$(ms).on('focus',function(){if(ms.input.length){ms.input.attr('placeholder','');$('.ms-sel-ctn').append(closeButton);$(".msCloseButton").on('click',loseFocus);ms.helper.show();$bottomSection.css("visibility","hidden");if($remoteLoginForm.length){$remoteLoginForm.css("visibility","hidden");}}});$(ms).on('blur',function(){if(ms.input.length){ms.input.attr('placeholder',placeholder);$('#msBlur').remove();hideExtraMSContent();$bottomSection.css("visibility","visible");if($remoteLoginForm.length){$remoteLoginForm.css("visibility","visible");}}});$(ms).on('load',function(e,m){console.warn(JSON.stringify(this.getValue()));});$(ms).on('selectionchange',function(e){e.preventDefault();try{if(e.currentTarget.getSelection().length>0){let selectedData=ms.getSelection()[0],isConsentingToSeamlessAccess=$('.institution-preference-userconsent-checkbox').is(':checked');if(!selectedData.institutionUrl)return;if(typeof SeamlessAccessService!=='undefined'&&isConsentingToSeamlessAccess){SeamlessAccessService.updateEntity({title:selectedData.name,entityID:selectedData.entityId,}).then(function(){window.location.href=selectedData.institutionUrl;}).catch(function(e){window.location.href=selectedData.institutionUrl;console.error(e);});}else{window.location.href=selectedData.institutionUrl;}}}catch(e){console.error(e);}});}};


$(function(){$('.identityTokenWidget').each(function(){var $form=$(this).find('form');var $submit=$form.find('.submit');var $token=$form.find('.token');var change=function(){if(!$token.val()){$submit.attr('disabled',true);}else{$submit.prop('disabled',false);}};$token.on('keyup input',change);change();});});


$(function(){var $purchase=$('.purchaseArea');$purchase.on('click','.expand-link',function(event){event.preventDefault();var $link=$(this);var $content=$link.nextAll('.content');$link.toggleClass('active');$content.toggleClass('hidden');});$('.save-for-later-link').on("click",function(){$(".save-for-later-link").hide();$(".saved-go-cart").show();$(".saved-go-cart").removeClass("hidden");});$('.add-article-to-cart').on("click",function(){if($(this).find('.icon-arrow_d_n').length){return;}
$(".save-for-later-link").hide();});var $deepdyve=$purchase.find('.deep-dyve');if($deepdyve.length){var url='https://www.deepdyve.com/rental-link';var data=$deepdyve.data();if(data.affid&&data.issn&&data.doi){$.ajax({url:url,data:{docId:data.doi,fieldName:'journal_doi',journal:data.issn,affiliateId:data.affid,format:'jsonp'},dataType:'jsonp',jsonp:'callback'}).then(function(json){if(json.status==='ok'){$deepdyve.attr('href',json.url);$deepdyve.removeClass('hidden');}});}}});


$(function(){var $drawer=$('.society-id-status');var $content=$drawer.find('.content');$content.slideDown('fast');$drawer.on('click','.cancel',function(event){$content.slideUp('fast');$drawer.addClass('hidden');event.preventDefault();});hideSocietyStatusDialog($drawer)});function hideSocietyStatusDialog($drawer){$drawer.delay(8000).hide(0);};

var raa = {};

$(document).ready(function () {
    $(".show-request-reset-password").on("click",function () {
        if ($('.password-recaptcha-ajax').length &&  $('.LBD_CaptchaDiv').length < 1)
            $.ajax({
                type: 'GET',
                dataType: 'html',
                url: '/pb/widgets/CaptchaResponseHandler/'
            }).done(function (data) {
                $('.password-recaptcha-ajax').append(data)
            })
    });
    $(".show-request-username").on("click",function () {
        if ($('.username-recaptcha-ajax').length)
            $.ajax({
                type: 'GET',
                dataType: 'html',
                url: '/pb/widgets/CaptchaResponseHandler/'
            }).done(function (data) {
                $('.username-recaptcha-ajax').append(data)
            })
    });
});

raa.EntitlementsWidget = function(widgetDef, element) {
    literatum.Widget.call(this, widgetDef, element);
};

raa.EntitlementsWidget.prototype = new literatum.Widget();

raa.EntitlementsWidget.id = 'eCommerceAccessEntitlementWidget';
raa.EntitlementsWidget.action = '/pb/widgets/raa/entitlements';

raa.EntitlementsWidget.prototype.reloadTab = function(tab) {
    var widget = this;
    var loading = new literatum.FullPageLoading().start();
    var $tabContent = this.find("#" + tab);
    var $form = $tabContent.find("form");
    var $query = $form.find("input[name='query']");
    var $sort = $form.find("select");
    literatum.widgets.render(widget, {}, {
        sort: $sort.val(),
        query: $query.val(),
        selectedTab: tab.replace('pane-', '')
    }, function () {
        loading.done();
        if (typeof jcf !== "undefined")
            jcf.replace($('.jcf[data-bind-change="sort"]'));
    }, function(html) {
        if($(html.trim()).hasClass("tab__pane")){
            $(html.trim()).each(function() {

                if ($(this).hasClass("tab__pane")) {
                    var find = $('<div>').append($(this).html());
                    $tabContent.html(find);
                }
            });

        }
        else{
            var find= $(html.trim()).find(".tab__pane");
            $tabContent.html(find.html());
        }
        widget.registerListeners();
    });
};

raa.EntitlementsWidget.binders = {
    series: function(e, widget) {
        e.preventDefault();
        widget.find(".tab__nav li").removeClass("active");
        $(e.target).closest("li").addClass("active");
        widget.find(".tab__pane").removeClass("active");
        var $tabContent = widget.find("#pane-series");
        if ($tabContent.children().length == 0) {
            widget.reloadTab('series');
        } else {
            $tabContent.find(".tab__pane").addClass("active");
        }
    },
    groups: function(e, widget) {
        e.preventDefault();
        widget.find(".tab__nav li").removeClass("active");
        $(e.target).closest("li").addClass("active");
        widget.find(".tab__pane").removeClass("active");
        var $tabContent = widget.find("#pane-groups");
        if ($tabContent.children().length == 0) {
            widget.reloadTab('groups');
        } else {
            $tabContent.find(".tab__pane").addClass("active");
        }
    },
    items: function(e, widget) {
        e.preventDefault();
        widget.find(".tab__nav li").removeClass("active");
        $(e.target).closest("li").addClass("active");
        widget.find(".tab__pane").removeClass("active");
        var $tabContent = widget.find("#pane-items");
        if ($tabContent.children().length == 0) {
            widget.reloadTab('items');
        } else {
            $tabContent.find(".tab__pane").addClass("active");
        }
    },
    submitSearch: function (e, widget) {
        e.preventDefault();
        widget.reloadTab($(e.target).closest(".tab__pane").attr("id"));
    },
    sort: function (e, widget) {
        if(e.type=='change') {
            widget.reloadTab(widget.find(".tab__pane:visible").attr("id"));
        }
    }
};

raa.EntitlementsWidget.prototype.registerListeners = function() {
    Object.getPrototypeOf(raa.EntitlementsWidget.prototype).registerListeners.call(this);
    var widget = this;
    this.find("input[name='query']").closest("form").submit(function(e){
        e.preventDefault();
        raa.EntitlementsWidget.binders.submitSearch(e, widget);
    });
};

raa.EntitlementsWidget.find = function() {
    var $result = $("*[data-widget-def='" + raa.EntitlementsWidget.id +"']");
    if ($result.length > 0) {
        return $result;
    }
    return $("." + raa.EntitlementsWidget.id);
};

literatum.widgets.register(raa.EntitlementsWidget);


if(document.addEventListener){document.addEventListener("DOMContentLoaded",twoFactorAuthentication,false);}
else{document.onreadystatechange=twoFactorAuthentication;}
function twoFactorAuthentication(){if(document.getElementById('select-list-hidden')){var first=document.getElementById('container-all');var scrollableList=document.createElement("div");scrollableList.setAttribute('class','scrollableList');first.appendChild(scrollableList);var parent_node=document.querySelectorAll('.scrollableList');var selectOneOfTheOptions=document.createElement("div");selectOneOfTheOptions.setAttribute('id','selectOneOfTheOptions');parent_node[0].appendChild(selectOneOfTheOptions);var js__countries_select=document.createElement("ul");js__countries_select.setAttribute('tabindex','-1');js__countries_select.setAttribute('id','js__countries-select');js__countries_select.setAttribute('class','f32 hide');parent_node[0].appendChild(js__countries_select);var selectList=document.getElementById('select-list-hidden').getElementsByTagName('option');for(var j=0;j<selectList.length;j++){var a=selectList[j];var countries_text=selectList[j].text;var ulss=document.getElementById('js__countries-select');var classesAll=selectList[j].getAttribute("class");var node=document.createElement("li");ulss.appendChild(node);var ulss=document.getElementById('js__countries-select').getElementsByTagName('li')[j];var linkes_to_add=document.createElement("a");var textnode=document.createTextNode(countries_text);if(j==0){linkes_to_add.setAttribute('tabindex','0');}
linkes_to_add.setAttribute('href','#');linkes_to_add.appendChild(textnode);linkes_to_add.setAttribute('class',classesAll);ulss.appendChild(linkes_to_add);}
var li23=document.createElement('i');li23.innerHTML='';li23.setAttribute('class','countries-select ');document.getElementById("selectOneOfTheOptions").appendChild(li23);var true2=document.getElementById('selectOneOfTheOptions').getElementsByTagName("a");var innerdeep;var innerdeepLi=document.getElementById("js__countries-select").getElementsByTagName("li");var countrySelectList=document.getElementById('select-list-hidden');var selectedCountry=countrySelectList.options[countrySelectList.selectedIndex].text
if(selectedCountry){for(var i=0;i<innerdeepLi.length;i++){if(innerdeepLi[i].textContent===selectedCountry){innerdeep=innerdeepLi[i].getElementsByTagName("a")[0];break;}}}
document.createElement('a');var like=innerdeep;true2.innerHTML=like;var clon3=like.cloneNode(true);var res=clon3.innerHTML.split("+");clon3.innerHTML='+'+res[1];document.getElementById("selectOneOfTheOptions").appendChild(clon3);document.getElementById("selectOneOfTheOptions").onclick=function(e){if(typeof e=='undefined')e=window.event;e.preventDefault?e.preventDefault():(e.returnValue=false);if(document.getElementById("js__countries-select").className=="f32 hide"){e.preventDefault?e.preventDefault():(e.returnValue=false);document.getElementById("js__countries-select").className="f32";var focusedElement=document.getElementById("js__countries-select").getElementsByTagName('a')[0];focusedElement.focus();e=e||window.event;document.getElementById("js__countries-select").className="f32";}
else{document.getElementById("js__countries-select").className="f32 hide";}};var ul=document.getElementById('js__countries-select');if(ul.addEventListener){ul.addEventListener("click",function(e){functionX((e||event))},false);}
else{ul.attachEvent("onclick",function(e){functionX((e||event))});}
function functionX(e){var targetedElement=null;if(typeof e=='undefined')e=window.event;if(typeof e.srcElement=='undefined'){targetedElement=e.originalTarget;}else{targetedElement=e.srcElement;}
if(targetedElement.tagName==='A'){e.preventDefault?e.preventDefault():(e.returnValue=false);var firstchildnew=document.getElementById('selectOneOfTheOptions').getElementsByTagName('a')[0];var true1=document.getElementById('selectOneOfTheOptions').getElementsByTagName("a");if(true1){e.preventDefault?e.preventDefault():(e.returnValue=false);true1.innerHTML=targetedElement;var clon3=targetedElement.cloneNode(true);var res=clon3.innerHTML.split("+");clon3.innerHTML='+'+res[1];document.getElementById("selectOneOfTheOptions").appendChild(clon3);firstchildnew.remove();}
functionaddToHidden(e);}}
document.getElementById('js__mobile-countries').onkeydown=function(e){if(typeof e=='undefined'){e=window.event;}
functionaddToHidden(e);};function stripNonNumbers(val){return val.replace(/\D/g,'');}
document.getElementById('js__mobile-countries').onkeyup=function(e){var start=this.selectionStart,end=this.selectionEnd;this.value=stripNonNumbers(this.value);this.setSelectionRange(start,end);};document.getElementById('js__mobile-countries').addEventListener("focusout",function(e){this.value=stripNonNumbers(this.value);});document.getElementById('js__countries-select').getElementsByTagName('a').onmousedown=function(e){if(typeof e=='undefined')e=window.event;functionaddToHidden(e);};function functionaddToHidden(e){var input=document.getElementById('js__mobile-countries');var messages=document.getElementById('codeAndPhone');e=e||window.event;if(typeof e=='undefined')e=window.event;if(typeof e.srcElement=='undefined'){var sourceb=e.originalTarget;}else{var sourceb=e.srcElement;}
if(sourceb.tagName=="A"){var code2=sourceb.innerHTML;var res=code2.split("+");code2='+'+res[1];var messages=document.getElementById('codeAndPhone');messages.value=code2+input.value;}
else if(sourceb.tagName=="INPUT"){if(input.addEventListener){input.addEventListener("input",function(e){functionY((e||event))},false);}
else{input.attachEvent("onpropertychange",function(e){functionY((e||event))});}
function functionY(e){var code=document.getElementById('selectOneOfTheOptions').getElementsByTagName('a')[0].innerHTML;var res=code.split("+");code='+'+res[1];messages.value=code+input.value;};}
document.getElementById("js__countries-select").className="f32 hide";}
function hasClass(element,cls){return(' '+element.className+' ').indexOf(' '+cls+' ')>-1;}
document.onmousedown=function(e){if(typeof e=='undefined')e=window.event;if(typeof e.srcElement=='undefined'){var sourceE=e.originalTarget;}else{var sourceE=e.srcElement;}
if((closestt(sourceE,'.js__pincode-container')==null)&&!(sourceE.id=="js__countries-select")){if(document.getElementById('js__mobile-countries')){document.getElementById("js__countries-select").className="f32 hide";}}};function closestt(el,selector){while(el!==null){elementParent=el.parentElement;if(elementParent!==null&&(hasClass(elementParent,selector)||hasClass(el,"flag"))){return elementParent;}
el=elementParent;}
return null;}
function hide(){var elem=document.getElementById('select-list-hidden');elem.style.display='none';}
window.onload=hide;function findNextTabStop(el,dir){var universe=document.querySelectorAll('#js__countries-select a');var list=Array.prototype.filter.call(universe,function(item){return item.tabIndex>="-1"});var index=list.indexOf(el);if(dir=="next"){return list[index+1]||list[0];}else{return list[index-1]||list[0];}}
document.onkeydown=function(event){event=event||window.event;if(typeof event.srcElement=='undefined'){var classes=event.originalTarget;}else{var classes=event.srcElement;}
if(event.keyCode==40||event.which==40){event.preventDefault?event.preventDefault():(event.returnValue=false);var nextEl=findNextTabStop(classes,"next");nextEl.focus();}
else if(event.keyCode==38||event.which==38){event.preventDefault?event.preventDefault():(event.returnValue=false);var nextEl=findNextTabStop(classes,"prev");nextEl.focus();}
var isEscape=false;if("key"in event){isEscape=event.key=="Escape";}else{isEscape=event.keyCode==27;}
if(isEscape){document.getElementById("js__countries-select").className="f32 hide";}
var targetEL=event.target;if((event.keyCode==13||event.which==13)&&hasClass(targetEL,"flag")){if(document.getElementById("js__countries-select").className=="f32 hide"){var focusedElement=document.getElementById("js__countries-select").getElementsByTagName('a')[0];focusedElement.focus();event=event||window.event;document.getElementById("js__countries-select").className="f32";}else{if(!(hasClass(document.getElementById("js__countries-select"),"hide"))){event.preventDefault?event.preventDefault():(event.returnValue=false);document.getElementById("js__mobile-countries").focus();document.getElementById("js__countries-select").className="f32 hide"}}
var keycode1=(event.keyCode?event.keyCode:event.which);var targetedElement=event.target;if(targetedElement.tagName==='A'){var firstchildnew=document.getElementById('selectOneOfTheOptions').getElementsByTagName('a')[0];var true1=document.getElementById('selectOneOfTheOptions').getElementsByTagName("a");if(true1){var targetedElement=event.target;var like=targetedElement;var li2=document.createElement('a');li2.setAttribute('href','#');true1.innerHTML=li2;var toremove=document.getElementById('selectOneOfTheOptions').getElementsByTagName("a")[0];var toremoveinner=toremove;var clon3=like.cloneNode(true);var res=clon3.innerHTML.split("+");clon3.innerHTML='+'+res[1];document.getElementById("selectOneOfTheOptions").appendChild(clon3);firstchildnew.remove();}}}
e=event||document.event;if(typeof e=='undefined')e=document.event;if(((e.keyCode>=65&&e.keyCode<=95)||(e.keyCode>=106&&e.keyCode<=130))||((e.which>=65&&e.which<=95)||(e.which>=106&&e.which<=130))){var keycode1=(e.keyCode?e.keyCode:e.which);var string1=String.fromCharCode(keycode1);var searchon1=document.getElementById('js__countries-select').getElementsByTagName('a');for(var j=0;j<searchon1.length;j++){var a=searchon1[j];var countries_text=searchon1[j].innerHTML;var chare=countries_text.charAt(0);var lowercase=chare.toLowerCase();var lowString1=string1.toLowerCase();if(lowString1==lowercase){searchon1[j].focus();return true;}}}};}
if(document.getElementById('check-if-exist')){setTimeout(function(){document.getElementById('hidden-message').style.visibility="visible";document.getElementById('hidden-message').style.display="block";},30000);}
var submit,passPin=document.getElementsByClassName("type-pass-pin")[0];if(passPin){passPin.addEventListener('keyup',inner);passPin.addEventListener('input',inner);function inner(){var children=this.form.children;for(var i=0;i<children.length;i++){if(children[i].className==="OK-btn"){submit=children[i];break;}}
submit&&(submit.disabled=(!this.value))}}
var pinForm=document.getElementsByClassName('js__pinCode')[0];if(pinForm){pinForm.addEventListener('submit',function(){var passPin=document.getElementsByClassName('type-pass-pin')[0];var pinValue=passPin.value;var numeric=isNumeric(pinValue);if(!numeric||pinValue==''||pinValue=="Type the 6 diget PIN  Code"){var errorMsg=this.querySelector('.error-msg')
errorMsg.innerHTML="Please fill this field with numbers";errorMsg.className=errorMsg.className.replace(/\bhidden\b/,'');return false;}});}
document.querySelectorAll('.js__tfaOptionVisible').forEach(function(el){el.addEventListener('click',function(event){event.preventDefault();tfaOptionVisible(event);});});document.querySelectorAll('.js__tfaResetAuthentication').forEach(function(el){el.addEventListener('click',function(event){event.preventDefault();tfaResetAuthentication()});});}
function isNumeric(n){return!isNaN(parseFloat(n))&&isFinite(n);}
if(!(typeof jQuery=='undefined')){(function($){var selectElement=$(".scrollableList").siblings("select");$(".scrollableList").siblings().each(function(){if($(this).hasClass("sbHolder")){selectElement.selectbox("detach");}else if($(this).hasClass("bootstrap-select")){$(this).hide();}});selectElement.hide();})(jQuery);$(function(){jQuery('.pb-collapse').on("click",function(){jQuery(".notAuth-msg-container").toggleClass('collapsed');jQuery(this).find('img').toggle();});});}
function tfaOptionVisible(event){event.preventDefault()
if(document.getElementById('tfa-options')){if(document.getElementById('tfa-options').style.display=='none'){document.getElementById('tfa-options').style.display='block';}
else{document.getElementById('tfa-options').style.display='none';}}}
function tfaResetAuthentication(){if(document.getElementById('reset-verification-warning').style.display=='none'){document.getElementById('reset-verification-warning').style.display='block';document.getElementsByClassName('reset-verification-option')[0].style.display='none';if(document.getElementById('tfa-options').scrollHeight<=20){document.getElementById('tfa-options').style.display='none';}}
var redirectUri=document.getElementsByName('redirectUri')[0].value;document.getElementsByName('redirectUri')[0].value=encodeURI('/action/resetTfaMethod?redirectUri='+redirectUri);};


$(function(){$(".allowance__message").on("click",function(){$(".allowance__text").toggleClass("hidden");$(".allowance__message .arrow_d_n").toggleClass("openAllowance");$(".allowance__message .icon-angle-down").toggleClass("openAllowance");});$(".preview_button").on("click",function(){$(".preview__modal.popup").removeClass("hidden");$("body.pb-ui").addClass("noscroll");});$(".preview__modal .icon-preview-close_thin,.preview__options .btn-cancel,.preview__content .close").on("click",function(){$(".preview__modal.popup").addClass("hidden");$("body.pb-ui").removeClass("noscroll");})});

$(function(){
    function loadContent() {
        const $this = $(this).closest(".general-rss-feed-reader");
        var $resultsTarget = $(this).find('.rss-body');
        var url = $(this).data('rss-url');
        var data = {};
        if (url) {
            data.url = url;
        }
        $this.pbAjax({
            type: 'POST',
            url: '/pb/widgets/rssWidget/loadWidget',
            data: data,
            dataType: 'html',
            async:'false',
            success: function(data) {
                $resultsTarget.html(data);
            }
        });
    }

    function init() {
        $( ".general-rss-feed-reader" ).each(loadContent);
    }

    if (window.PB && window.PB.$) {
        window.PB.$(document.documentElement).on("WidgetReinit.general-rss-feed-reader", init);
    }
    init();
});


(function($){function init(){$(".accessWidget .sortBy").change(function(e){var sortByUrl=$(this).val();window.location.href=sortByUrl;});}
$(init);if(window.PB&&window.PB.$){window.PB.$(document.documentElement).on("WidgetReinit.accessWidget WidgetReinit.literatumAccessWidget",init);}})(jQuery);$(function(){$(".collectionItem").click(function(e){e.preventDefault();var $target=$(this).closest('tr');if($(this).hasClass('loaded')){renderAccessWidgetContent('',$target,true);}else{var $widget=$(this).closest(".literatumAccessWidget");var code=$(this).attr('data-id');$widget.pbAjax({type:'GET',url:'/pb/widgets/AccessWidgetController/category',dataType:'html',async:'false',data:{categoryCode:code},success:function(data){renderAccessWidgetContent(data,$target,false);}});$(this).addClass("loaded");}})});function renderAccessWidgetContent(data,$target,loaded){if(loaded)
$target.next().toggle();else
$target.after(data);}
$(function(){$(".publicationsList").click(function(e){e.preventDefault();var $target=$(this).parent().parent().next();if($(this).hasClass('loaded')){if($(this).hasClass('open')){$(this).removeClass('open');$(this).attr("aria-label","list the license content")}else{$(this).addClass('open');$(this).attr("aria-label","hide the license content")}
$target.toggle();}else{var licenseId=$(this).attr('license-id');var licenseCode=$(this).attr('license-code');$target.addClass("acs_ajaxOverlay");$.ajax({type:'GET',url:'/pb/widgets/AccessWidgetController/publications',dataType:'html',async:'false',data:{licenseId:licenseId,licenseCode:licenseCode,page:'1'},success:function(data){$target.removeClass("acs_ajaxOverlay");$target.html(data);}});$(this).addClass("loaded");$(this).addClass('open');$(this).attr("aria-label","hide the license content")}})});$(document).on('click',".publicationPagination a",function(e){e.preventDefault();var $target=$(this).closest('tr');if($(this).hasClass('loaded')){$target.next().toggle();}else{var url=$(this).attr('href');$.ajax({type:'GET',url:url,dataType:'html',async:'false',success:function(data){$target.html(data);}});$(this).addClass("loaded");}});


$(document).ready(function(){$('.fed-link').on('click',function(e){e.preventDefault();UX.federatedLogin.openFederationPage(this);});$("#hideLocalStoragePreventedMsg").on("click",function(e){e.preventDefault();UX.federatedLogin.hideLocalStoragePreventedMsg();});$("#back-container").on("click",function(e){e.preventDefault();UX.federatedLogin.backToFedsList();});});


$(document).ready(function(){const $form=$('#slotLicenceConfirmationMessageForm');const $textInputField=$('#textInputField');const $submitBtn=$('#submitBtn');if($textInputField.length){$textInputField.on('input',function(){UX.accessDenial.textInputFieldTyping();$submitBtn.prop('disabled',!$(this).val().trim());});}
$form.on('submit',function(event){if(model.enabledTextInput){const isValid=UX.accessDenial.validateSlotLicenceConfirmationMessageForm();if(!isValid){event.preventDefault();}}});});


$(document).ready(()=>{const recentInstitutionsSection=$(".recent-institutions-section");const editBtn=$("#edit-btn");const recentInstitutionsList=$("#recent-institutions-list");if(recentInstitutionsSection.length){getSupportedIDPEntities().then((supportedIDPEntities)=>{if(supportedIDPEntities.length>0){addEntityListToRecentInstitutions(supportedIDPEntities.reverse());recentInstitutionsSection.removeClass("hidden");if(recentInstitutionsList.find('li').length){$("#choose-view-header .no-inst-heading").addClass("hidden");$("#choose-view-header .sub-heading").removeClass("hidden");editBtn.removeClass("hidden");}
else{$("#choose-view-header .no-inst-heading").removeClass("hidden");$("#choose-view-header .sub-heading").addClass("hidden");editBtn.addClass("hidden");}}
else{$("#choose-view-header .no-inst-heading").removeClass("hidden");$("#choose-view-header .sub-heading").addClass("hidden");editBtn.addClass("hidden");}});}});function escapeHTML(unsafeText){return unsafeText.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
async function getSupportedIDPEntities(){let allIDPEntitiesList=[];let supportedIDPEntitiesList=[];try{let idpEntitiesList=await SeamlessAccessService.retrieveEntity();while(idpEntitiesList.length>0&&supportedIDPEntitiesList.length<3){allIDPEntitiesList=[...idpEntitiesList,...allIDPEntitiesList];const areSupportedResults=await areSupportedIDPEntities(idpEntitiesList);const currentSupportedIDPEntities=idpEntitiesList.filter((entity)=>areSupportedResults[entity.entity.entityID]==="true");supportedIDPEntitiesList=[...currentSupportedIDPEntities,...supportedIDPEntitiesList];for(const entityObject of idpEntitiesList){await SeamlessAccessService.removeEntity(entityObject.entity.entityID);}
idpEntitiesList=await SeamlessAccessService.retrieveEntity();}
for(const entityObject of allIDPEntitiesList){await SeamlessAccessService.updateEntity(entityObject.entity);}}catch(error){console.error('An error occurred while getting Supported identity provider Entities');}
return supportedIDPEntitiesList.length>3?supportedIDPEntitiesList.slice(-3):supportedIDPEntitiesList;}
async function areSupportedIDPEntities(entities){const idpEntities=entities.map(entity=>entity.entity);const entityIDs=idpEntities.map(idpEntity=>idpEntity.entityID);const entityIDParams=entityIDs.map(id=>`entitiesId=${id}`).join('&');const areSupportedEntitiesUrl=`/pb/widgets/shibboleth/areSupportedEntities?${entityIDParams}`;try{const areSupportedEntitiesResponse=await fetch(areSupportedEntitiesUrl);if(!areSupportedEntitiesResponse.ok){throw new Error(`HTTP error! status: ${areSupportedEntitiesResponse.status}`);}
const areSupportedEntitiesData=await areSupportedEntitiesResponse.json();return areSupportedEntitiesData;}catch(error){console.error('An error occurred while checking if the entities are supported');return{};}}
function addEntityListToRecentInstitutions(entityList){let html='';entityList.forEach((entity)=>{const idpEntity=entity.entity
const updateEntityData={entityID:idpEntity.entityID,title:idpEntity.title};let recentInstitutionDomain=""
if(idpEntity.domain){updateEntityData.domain=idpEntity.domain
recentInstitutionDomain="<span class='recent-institution-domain'>"+escapeHTML(idpEntity.domain)+"</span>"}
if(idpEntity.entity_icon_url&&idpEntity.entity_icon_url.url){updateEntityData.entity_icon_url=idpEntity.entity_icon_url
html+="<li class='recent-institution-item' tabindex='0'><a class='idp-institution-entity' data-updateEntity='"+escapeHTML(JSON.stringify(updateEntityData))+"' data-idpUrl='"+SeamlessAccessService.getWAYFLessUrl(idpEntity.entityID)+"'><img class='recent-institution-icon' src='"+escapeHTML(idpEntity.entity_icon_url.url)+"' width='"+escapeHTML(idpEntity.entity_icon_url.width)+"' height='"+escapeHTML(idpEntity.entity_icon_url.height)+"' aria-hidden='true'><div class='name-domain-container'><span class='recent-institution-name'>"+escapeHTML(idpEntity.title)+"</span>"+recentInstitutionDomain+"</div>"+"<i class='icon-arrow-right' aria-hidden='true'> </i><i class='icon-close hidden' aria-label='remove institution' role='button'> </i></a></li>";}else{html+="<li class='recent-institution-item' tabindex='0'><a class='idp-institution-entity' data-updateEntity='"+escapeHTML(JSON.stringify(updateEntityData))+"' data-idpUrl='"+SeamlessAccessService.getWAYFLessUrl(idpEntity.entityID)+"'><i class='recent-institution-icon icon-seamless-access' aria-hidden='true'></i><div class='name-domain-container'><span class='recent-institution-name'>"+escapeHTML(idpEntity.title)+"</span>"+recentInstitutionDomain+"</div>"+"<i class='icon-arrow-right' aria-hidden='true'> </i><i class='icon-close hidden' aria-label='remove institution' role='button'> </i></a></li>";}});$('#recent-institutions-list').append(html);}
$("#edit-btn").click(function(){$("#recent-institutions").removeClass('choose-view').addClass('edit-view');$("#choose-view-header").addClass("hidden")
$("#edit-view-header").removeClass("hidden")
$("#edit-btn").addClass("hidden")
$("#done-btn").removeClass("hidden")
$(".icon-arrow-right").addClass("hidden");$("#recent-institutions-list .icon-close").removeClass("hidden");$("#recent-institutions .recent-institution-item:first").focus();});$("#done-btn").click(function(){$("#recent-institutions").removeClass('edit-view').addClass('choose-view');$("#choose-view-header").removeClass("hidden")
$("#edit-view-header").addClass("hidden")
!$("#recent-institutions-list")?.find('li')?.length?$("#edit-btn")?.addClass("hidden"):$("#edit-btn")?.removeClass("hidden");$("#done-btn").addClass("hidden")
$(".icon-arrow-right").removeClass("hidden");$("#recent-institutions-list .icon-close").addClass("hidden");$("#recent-institutions .recent-institution-item:first").focus();});$(document).on('click','#recent-institutions .icon-close',function(event){event.stopPropagation();let recentInstitutionItem=$(this).closest(".recent-institution-item");let recentInstitutionEntity=recentInstitutionItem.children('.idp-institution-entity').first();let updateEntityData=recentInstitutionEntity.data('updateentity');SeamlessAccessService.removeEntity(updateEntityData.entityID).then((res)=>{recentInstitutionItem.remove();if(!$("#recent-institutions-list").find('li').length){$("#choose-view-header .sub-heading").addClass("hidden");$("#choose-view-header .no-inst-heading").removeClass("hidden");$("#done-btn").click();}}).catch((error)=>{console.error('could not remove the entity');});});$(document).on('keydown','.recent-institution-item',function(event){if(event.key==='Enter'){event.preventDefault();if($('#recent-institutions').hasClass('edit-view')){$(this).find('.icon-close').click();}else{$(this).find('.idp-institution-entity').click();}}});$(document).on('click','#recent-institutions .idp-institution-entity',function(event){if(!$('#recent-institutions').hasClass('edit-view')){const updateEntityData=$(this).data('updateentity');let href=$(this).data('idpurl');SeamlessAccessService.updateEntity(updateEntityData).then(function(res){if(href!==undefined){window.location.href=href;}}).catch(function(err){if(href!==undefined){window.location.href=href;}})}else{$(this).find('.icon-close').click();}});$(document).on('mouseenter','#recent-institutions .idp-institution-entity',function(){$(this).addClass("active");});$(document).on('mouseleave','#recent-institutions .idp-institution-entity',function(){$(this).removeClass("active");});$('.federation--list-inner li a').on('click',function(e){e.preventDefault()
const inst=$(this).data("name");const entityId=$(this).data("entityid");const direction=$(this).attr("href");try{SeamlessAccessService.updateEntity({title:inst,entityID:entityId,}).then(function(){window.location.href=direction;}).catch(function(e){window.location.href=direction;});}
catch(e){window.location.href=direction;console.error(e)}});

