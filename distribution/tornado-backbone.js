/**
 * User: Martin Martimeo
 * Date: 08.08.13
 * Time: 14:48
 *
 * Core Lib
 */

define("tornado", ["jquery", "underscore", "backbone"],function ($, _, Backbone) {
    var Tornado = {};

    /**
     * Operator defined by restless
     *
     * @TODO Add Tornado Restless Operators
     */
    Tornado.Operator = {
        equals: ["==", "eq", "equals", "equals_to"],
        unequals: ["!=", "ne", "neq", "does_not_equal", "not_equal_to"],
        gt: [">", "gt"],
        lt: ["<", "lt"],
        gte: [">=", "ge", "gte", "geq"],
        lte: ["<=", "le", "lte", "leq"],
        element_of: ["in", "element_of"],
        not_element_of: ["not_in", "not_element_of"],
        is_null: ["is_null"],
        is_not_null: ["is_not_null"],
        like: ["like"],
        has: ["has"],
        any: ["any"]
    };

    /**
     * If set, all sync calls will be enriched with this token
     */
    Tornado.xsrf_token = null;

    /**
     * Enriched Backbone model with a lot of information about the sqlalchemy model
     *
     * @type Tornado.Model
     */
    Tornado.Model = Backbone.Model.extend({

        /**
         * Schema for use with backbone-forms
         */
        schema: {},

        /**
         * List of default values
         */
        defaults: {},

        /**
         * Collection URL entry point
         */
        urlRoot: null,

        /**
         * Either idAttribute (if one pk) or idAttributes (more than one pk) for referencing the model
         */
        idAttribute: null,
        idAttributes: null,

        /**
         * Information about the defined relations for the model
         */
        relations: [],

        /**
         * Bunch of information about the model
         */
        columnAttributes: [], //! All columns
        relationAttributes: [], //! All relations
        readonlyAttributes: [], //! Columns with 'readonly' in column.info

        /**
         * Guess the type based on the schema
         *
         * @param attribute
         */
        is_numeric: function (attribute) {
            if (this.schema.hasOwnProperty(attribute)) {
                if (this.schema[attribute].type == "Number") {
                    return true;
                }
                if (this.schema[attribute].type == "Text" && this.schema[attribute].dataType == "number") {
                    return true;
                }
            }
            return false;
        },

        /**
         * Guess the type based on the schema
         *
         * @param attribute
         */
        is_datetime: function (attribute) {
            if (this.schema.hasOwnProperty(attribute)) {
                if (this.schema[attribute].type == "DateTime") {
                    return true;
                }
                if (this.schema[attribute].type == "Date") {
                    return true;
                }
                if (this.schema[attribute].type == "Text" && this.schema[attribute].dataType == "datetime") {
                    return true;
                }
            }
            return false;
        },

        /**
         * Resolve all attributes that are datetimes
         *
         * @returns {*}
         */
        getDatetimeAttributes: function () {
            if (this.hasOwnProperty("datetimeAttributes")) {
                return this.datetimeAttributes;
            }
            var i, l, attribute, attributes = [];
            for (i = 0, l = this.columnAttributes.length; i < l; i++) {
                attribute = this.columnAttributes[i];
                if (this.is_datetime(attribute)) {
                    attributes.push(attribute);
                }
            }
            this.datetimeAttributes = attributes;
            return attributes;
        },

        /**
         * Overwriten parse to support datetime strings
         * @param response
         * @param options
         * @returns attributes
         */
        parse: function (response, options) {
            var attributes = Backbone.Model.prototype.parse.call(this, response, options);

            var i, l, attribute;
            for (i = 0, l = this.getDatetimeAttributes().length; i < l; i++) {
                attribute = this.datetimeAttributes[i];
                attributes[attribute] = new Date(attributes[attribute])
            }
            return attributes;
        },

        /**
         * Sync method with adds xsrf_token if available
         *
         * @param method
         * @param model
         * @param options
         * @returns {*}
         */
        sync: function (method, model, options) {
            if (Tornado.xsrf_token) {
                options = options || {};
                options.headers = options.headers || {};
                options.headers['X-XSRFToken'] = Tornado.xsrf_token;
            }
            return Backbone.sync(method, model, options);
        },

        /**
         * If the model provides a __str__ attribute
         * this will be used to displays in like backbone.forms
         */
        toString: function () {
            var rtn = this.get('__str__');
            if (rtn) {
                return rtn;
            }
            return "[object Tornado.Model at " + this.url() + "]";
        }


    });

    Tornado.Collection = Backbone.Collection.extend({

        // Objects on page
        page: 0,
        page_length: null,
        num_results: null,

        /**
         * Is this Collection fully loaded?
         */
        hasMore: function () {
            return this.num_results < this.models.length;
        },

        /**
         * Multiple call of fetch will increase in page count
         */
        fetch: function (options) {
            var collection = this;

            options = options ? _.clone(options) : {};
            options.data = options.data ? options.data : {};
            if (this.page_length) {
                options.data["results_per_page"] = this.page_length;
            }
            if (!options.data["page"]) {
                options.data["page"] = options.reset || !collection.page ? undefined : collection.page + 1;
            }

            this.trigger("page:fetch");

            return Backbone.Collection.prototype.fetch.call(collection, options);
        },

        // parse data from server
        // This is specific overwritten to work with flask-restless / tornado-restless
        parse: function (data) {
            var objects = data && data.objects;
            if (!objects) {
                this.trigger("page:complete");

                this.num_results = 0;
                this.page = 0;
                this.total_pages = 0;

                return objects;
            }

            this.num_results = data.num_results || data.length;
            this.page = data.page || 1;
            this.total_pages = data.total_pages || 0;

            if (this.num_results < this.models.length + objects.length) {
                this.trigger("page:showing", this.page);
            }
            this.trigger("page:complete");

            return objects;
        }
    });

    /**
     * A FilteredCollection
     *
     * It preserves a list of filters that are maintained for all queries
     *
     * @type Tornado.FilteredCollection
     */
    Tornado.FilteredCollection = Tornado.Collection.extend({

        /**
         * List of applied filters
         */
        filters: [],

        /**
         * Apply a filter
         *
         * filter: [list|object]: The filter
         * [options]: update: Update an existing filter
         *            nofetch: Do not fetch collection (useful for bulk updating)
         */
        filterBy: function (filter, options) {
            var collection = this;

            if (_.isArray(filter)) {
                if (filter.length > 2) {
                    filter = {'name': filter[0], 'op': filter[1], 'val': filter[2]};
                } else {
                    filter = {'name': filter[0], 'val': filter[2]};
                }
            } else if (_.isString(filter)) {
                filter = {'name': arguments[0], 'op': arguments[1], 'val': arguments[2]};
                options = arguments[3];
            }

            _.defaults(filter, {'op': 'eq'});

            if (options.update) {
                collection.filters = _.reject(collection.filters, function (f) {
                    return f.name == filter['name']
                });
            }
            collection.filters.push(filter);
            if (!options.nofetch) {
                collection.fetch({reset: true});
            }
        },

        /**
         * Apply a sorting
         *
         * filter: [list|object]: The filter
         * [options]: update: Update an existing filter
         *            nofetch: Do not fetch collection (useful for bulk updating)
         */
        sortBy: function (filter, options) {
            var collection = this;

            if (_.isArray(filter)) {
                if (filter.length > 2) {
                    filter = {'name': filter[0], 'op': filter[1]};
                } else {
                    filter = {'name': filter[0]};
                }
            } else if (_.isString(filter)) {
                filter = {'name': arguments[0], 'op': arguments[1]};
                options = arguments[2];
            }

            _.defaults(filter, {'op': 'asc'});

            if (options.update) {
                collection.filters = _.reject(collection.filters, function (f) {
                    return f.op == "asc" || f.op == "desc";
                });
            }
            collection.filters.push(filter);
            if (!options.nofetch) {
                collection.fetch({reset: true});
            }
        },

        /**
         * Remove a filter
         *
         * filter: [list|object|string]: The filter
         * [options]: nofetch: Do not fetch collection (useful for bulk updating)
         */
        removeFilter: function (filter, options) {
            var collection = this;

            if (_.isString(filter)) {
                collection.filters = _.reject(collection.filters, function (f) {
                    return f.name == filter
                });
            } else {
                collection.filters = _.reject(collection.filters, function (f) {
                    return f == filter
                });
            }
            if (!options.nofetch) {
                collection.fetch({reset: true});
            }
        },

        /**
         * Remove all sorting
         * [options]: nofetch: Do not fetch collection (useful for bulk updating)
         */
        removeSort: function (options) {
            var collection = this;

            collection.filters = _.reject(collection.filters, function (f) {
                return f.op == "asc" || f.op == "desc";
            });
            if (!options.nofetch) {
                collection.fetch({reset: true});
            }
        },

        /**
         * Augment Fetch with all information
         */
        fetch: function (options) {
            var collection = this;

            options = options ? _.clone(options) : {};
            options.data = options.data ? options.data : {};
            options.data["q"] = JSON.stringify({"filters": collection.filters});

            return Tornado.Collection.prototype.fetch.call(collection, options);
        }

    });

    return Tornado;
});

/**
 * User: Martin Martimeo
 * Date: 18.08.13
 * Time: 14:58
 *
 * Add filtered collection in html
 */

define("tornado/collection", ["jquery", "underscore", "backbone", "tornado"], function ($, _, Backbone, Tornado) {
    Tornado.BackboneCollection = Backbone.View.extend({

        events: {
            'click .btn-page': 'navigate'
        },

        initialize: function () {

            // Set collection
            if (this.options.collection) {
                if (_.isString(this.options.collection)) {
                    var constructor = window[this.options.collection];
                    if (!constructor) {
                        throw "Could not find constructor: " + this.options.collection;
                    }
                    this.collection = this.options.collection = new constructor();
                } else {
                    this.collection = this.options.collection;
                }
            }

            // Create Template
            if (this.options.template) {
                this.template = _.template($(this.options.template).text());
            } else {
                this.template = _.template(this.$el.html().replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
            }
            this.$el.empty();

            // Listen to model events
            this.listenTo(this.collection, 'add', this.addElement);
            this.listenTo(this.collection, 'remove', this.removeElement);
            this.listenTo(this.collection, 'hide', this.hideElement);
            this.listenTo(this.collection, 'show', this.showElement);
            this.listenTo(this.collection, 'sync', this.renderFooter);
            this.listenTo(this.collection, 'reset', this.render);

            // And add the css
            this.$el.addClass("tb-collection");
        },

        navigate: function (event) {
            var $target = $(event.currentTarget),
                next = parseInt($target.text());

            $target.closest('footer').find(".btn-page-active").removeClass('btn-page-active');
            $target.addClass('btn-page-active').addClass('btn-page-loading');

            if (!isNaN(next)) {
                this.collection.fetch({data: {page: next}});
            } else if ($target.is(".btn-step-forward")) {
                this.collection.fetch({data: {page: this.collection.page + 1}});
            } else if ($target.is(".btn-step-backward")) {
                this.collection.fetch({data: {page: this.collection.page - 1}});
            } else if ($target.is(".btn-fast-forward")) {
                this.collection.fetch({data: {page: this.collection.total_pages}});
            } else if ($target.is(".btn-fast-backward")) {
                this.collection.fetch({data: {page: 0}});
            } else {
                throw "Unexpected navigation target";
            }
        },

        render: function (options) {
            var $el = this.$el,
                self = this,
                collection = this.collection;

            options = _.extend(this.options, options || {});
            this.$el.empty();

            if (collection.length > 0 || options.reset) {
                self.renderElements(options);
                self.renderFooter(options);
            } else {
                collection.fetch({
                    success: function () {
                        self.renderElements(options);
                        self.renderFooter(options);
                    }
                });
            }

            //Set the main element
            self.setElement($el);

            //Set class
            $el.addClass(self.className);

            return self;
        },

        /**
         * render all elements
         */
        renderElements: function (/* options */) {
            var self = this,
                collection = this.collection;

            collection.each(function (model) {
                self.addElement(model);
            });
        },

        /**
         * add a single element
         *
         * @param model
         */
        addElement: function (model) {
            var self = this;

            var $el = self.$el.find("> [name='" + model.id + "']");
            if ($el.length == 0) {
                $el = $("<div></div>");
                $el.attr("name", model.id);
                self.$el.append($el);
            }
            $el.html(self.template(model.attributes));
        },

        /**
         * show a single element
         *
         * @param model
         */
        showElement: function (model) {
            var self = this;

            var $el = self.$el.find("> [name='" + model.id + "']");
            $el.show();
        },

        /**
         * hide a single element
         *
         * @param model
         */
        hideElement: function (model) {
            var self = this;

            var $el = self.$el.find("> [name='" + model.id + "']");
            $el.hide();
        },

        /**
         * del a single element
         *
         * @param model
         */
        removeElement: function (model) {
            var self = this;

            var $el = self.$el.find("> [name='" + model.id + "']");
            $el.remove();
        },

        /**
         * Renders the pagination layer
         *
         * Inspired by https://gist.github.com/io41/838460
         */
        renderFooter: function (/* options */) {
            var self = this,
                collection = this.collection;

            var info = {
                page: collection.page || 1,
                page_length: collection.page_length,
                total_pages: collection.total_pages || 0
            };

            self.$el.find("footer").remove();

            if (info.total_pages > 1 || info.page != 1 || collection.show_footer == 'always') {
                var $footer = $(self.constructor.footerTemplate(info));

                if (info.page < 2) {
                    $footer.find(".btn-fast-backward").addClass("disabled");
                    $footer.find(".btn-step-backward").addClass("disabled");
                } else if (info.page < 3) {
                    $footer.find(".btn-fast-backward").addClass("disabled");
                }

                if (info.page >= info.total_pages) {
                    $footer.find(".btn-fast-forward").addClass("disabled");
                    $footer.find(".btn-step-forward").addClass("disabled");
                } else if (info.page > info.total_pages) {
                    $footer.find(".btn-fast-forward").addClass("disabled");
                }

                self.$el.append($footer);
            }
        }

    }, {
        /* STATICS */

        footerTemplate: _.template('\
            <footer class="pagination">\
              <a class="btn btn-page btn-fast-backward"><i class="glyphicon glyphicon-fast-backward"></i></a>\
              <a class="btn btn-page btn-step-backward"><i class="glyphicon glyphicon-step-backward"></i></a>\
              <% if (page > 1) { %><a class="btn btn-page btn-page-number">1</a><% } %>\
              <% if (page >= 6) { %><span class="btn btn-page btn-page-ellipses">...</span><% } %>\
              <% if (page == 5) { %><a class="btn btn-page btn-page-number">2</a><% } %>\
              <% if (page > 3) { %><a class="btn btn-page btn-page-number"><%= (page-2) %></a><% } %>\
              <% if (page > 2) { %><a class="btn btn-page btn-page-number"><%= (page-1) %></a><% } %>\
              <a class="btn btn-page btn-page-number btn-page-active"><%= page %></a>\
              <% if (page < total_pages-1) { %><a class="btn btn-page btn-page-number"><%= (page+1) %></a><% } %>\
              <% if (page < total_pages-2) { %><a class="btn btn-page btn-page-number"><%= (page+2) %></a><% } %>\
              <% if (page == total_pages-3) { %><a class="btn btn-page btn-page-number"><%= (total_pages-1) %></a><% } %>\
              <% if (page <= total_pages-4) { %><span class="btn btn-page btn-page-ellipses">...</span><% } %>\
              <% if (page < total_pages) { %><a class="btn btn-page btn-page-number"><%= (total_pages) %></a><% } %>\
              <a class="btn btn-page btn-step-forward"><i class="glyphicon glyphicon-step-forward"></i></a>\
              <a class="btn btn-page btn-fast-forward"><i class="glyphicon glyphicon-fast-forward"></i></a>\
            </footer>\
        ')
    });

    /**
     * Allows to facility html elements with backbone-forms or model functionality
     *
     * @param option
     */
    $.fn.tbcollection = function (option) {
        var args = Array.prototype.slice.call(arguments, 1);

        return this.each(function () {
            var $this = $(this);
            var data = $this.data('tb.collection');

            var options = typeof option == 'object' && option;

            if (!data) {
                options["el"] = $this;
                $this.data('tb.collection', (data = new Tornado.BackboneCollection(options)));
                if (!options["delay"]) {
                    $this.data('tb.collection').render();
                } else {
                    $this.data('tb.collection').trigger("page:delay");
                }
            }
            if (typeof option == 'string') {
                data[option].apply(data, args);
            }
        });
    };
    $.fn.tbcollection.Constructor = Tornado.BackboneCollection;

    return Tornado;
});

// Facile elements with tornado-backbone-collection
$( document ).ready(function() {
    $('[data-collection][data-require]').each(function () {
        var $collection = $(this);

        require(["tornado/collection"], function () {
            require($collection.data('require').split(" "), function () {
                $collection.tbcollection($collection.data());
            });
        });
    });
    $('[data-collection]:not([data-require])').each(function () {
        var $collection = $(this);

        require(["tornado/form"], function () {
            $collection.tbcollection($collection.data());
        });
    });
});
/**
 * User: Martin Martimeo
 * Date: 13.08.13
 * Time: 18:30
 *
 * Extension to backbone-forms
 */

define("tornado/form", ["jquery", "underscore", "backbone", "tornado", "backbone-forms"], function ($, _, Backbone, Tornado) {
    Tornado.BackboneForm = Backbone.View.extend({

        initialize: function () {

            // Set Model
            if (this.options.model) {
                if (_.isString(this.options.model)) {
                    var constructor = window[this.options.model];
                    if (!constructor) {
                        throw "Could not find constructor: " + this.options.model;
                    }
                    this.model = this.options.model = new constructor();
                } else {
                    this.model = this.options.model;
                }
                if (_.isObject(this.options.value)) {
                    this.model.set(this.options.value);
                }
            }

            // Create Form
            this.form = new Backbone.Form(this.options);
            this.listenTo(this.form, 'all', this.handleFormEvent);
        },

        handleFormEvent: function (event, form, node) {
            this.trigger(event, node || form || this);

            // Retrigger event under tb:* namespace
            var args = event.split(":");
            if (args.length > 1) {
                this.trigger("tb:" + args[1], form, node);
                this.trigger("tb:" + args[1] + ":" + args[0], form, node);
            }
        },

        render: function () {
            var self = this.form,
                $form = this.$el,
                fields = this.form.fields;

            //Render standalone editors
            $form.find('[data-editors]').add($form).each(function (i, el) {
                var $container = $(el),
                    selection = $container.data('editors');

                if (_.isUndefined(selection)) {
                    return;
                }

                //Work out which fields to include
                var keys = (selection == '*')
                    ? self.selectedFields || _.keys(fields)
                    : selection.split(',');

                //Add them
                _.each(keys, function (key) {
                    var field = fields[key];

                    var el = field.editor.render().el;
                    if ($.webshims) {
                        $container.appendPolyfill(el);
                    } else {
                        $container.append(el);
                    }
                });

                $container.removeAttr('data-editors');
            });

            //Render standalone fields
            $form.find('[data-fields]').add($form).each(function (i, el) {
                var $container = $(el),
                    selection = $container.data('fields');

                if (_.isUndefined(selection)) {
                    return;
                }

                //Work out which fields to include
                var keys = (selection == '*')
                    ? self.selectedFields || _.keys(fields)
                    : selection.split(',');

                //Add them
                _.each(keys, function (key) {
                    var field = fields[key];

                    if (!field) {
                        console.error("Could not find " + key + " in fields for " + $form);
                        return;
                    }

                    field.schema = field.schema || {};
                    field.schema = _.extend(field.schema, $container.data("schema"));

                    var el = field.render().el;
                    if ($.webshims) {
                        $container.appendPolyfill(el);
                    } else {
                        $container.append(el);
                    }

                    // Update editor Attrs
                    field.schema.editorAttrs = field.schema.editorAttrs || {};
                    field.schema.editorAttrs = _.extend(field.schema.editorAttrs, $container.data("editorAttrs"));
                    field.editor.$el.attr(field.schema.editorAttrs);

                    // Add custom editor Class
                    field.editor.$el.addClass($container.data("editorClass"));

                });

                $container.removeAttr('data-fields');
            });

            //Render fieldsets
            $form.find('[data-fieldsets]').add($form).each(function (i, el) {
                var $container = $(el),
                    selection = $container.data('fieldsets');

                if (_.isUndefined(selection)) {
                    return;
                }

                _.each(self.fieldsets, function (fieldset) {

                    var el = fieldset.render().el;
                    if ($.webshims) {
                        $container.appendPolyfill(el);
                    } else {
                        $container.append(el);
                    }

                    // Update editor Attrs
                    fieldset.schema.editorAttrs = fieldset.schema.editorAttrs || {};
                    fieldset.schema.editorAttrs = _.extend(fieldset.schema.editorAttrs, $container.data("editorAttrs"));
                    fieldset.editor.$el.find("[data-editor] input").attr(fieldset.schema.editorAttrs);

                    // Add custom editor Class
                    fieldset.editor.$el.addClass($container.data("editorClass"));
                });

                $container.removeAttr('data-fieldsets');
            });

            //Set the main element
            self.setElement($form);

            //Set class
            $form.addClass(self.className);

            return self;
        }

    });

    /**
     * Allows to facility html elements with backbone-forms or model functionality
     *
     * @param option
     */
    $.fn.tbform = function (option) {
        var args = Array.prototype.slice.call(arguments, 1);

        return this.each(function () {
            var $this = $(this);
            var data = $this.data('tb.form');

            var options = typeof option == 'object' && option;

            if (!data) {
                options["el"] = this;
                $this.data('tb.form', (data = new Tornado.BackboneForm(options)));
                $this.data('tb.form').render();
            }
            if (typeof option == 'string') {
                data[option].apply(data, args);
            }
        });
    };
    $.fn.tbform.Constructor = Tornado.BackboneForm;

    return Tornado;
});

// Facile elements with tornado-backbone-form
$( document ).ready(function() {
    $('[data-form][data-require]').each(function () {
        var $form = $(this);

        require(["tornado/form"], function () {
            require($form.data('require').split(" "), function () {
                $form.tbform($form.data());
            });
        });
    });
    $('[data-form]:not([data-require])').each(function () {
        var $form = $(this);

        require(["tornado/form"], function () {
            $form.tbform($form.data());
        });
    });
});

/**
 * User: Martin Martimeo
 * Date: 17.08.13
 * Time: 17:32
 *
 * Extension to backbone_relations
 */

define("tornado/relation", ["jquery", "underscore", "backbone", "tornado", "backbone-relational"],function ($, _, Backbone, Tornado) {
    Tornado.RelationalModel = Backbone.RelationalModel.extend(Tornado.Model);
    return Tornado;
});