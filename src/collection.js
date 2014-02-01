/**
 * User: Martin Martimeo
 * Date: 18.08.13
 * Time: 14:58
 *
 * Add filtered collection in html
 */

require(["jquery", "underscore", "backbone"],function ($, _, Backbone) {
    var self = this.Tornado || {};
    var Tornado = this.Tornado = self;

    Tornado.BackboneCollection = Backbone.View.extend({

        events: {
            'click .btn-page': 'navigate'
        },

        initialize: function () {

            // Set collection
            if (this.options.collection) {
                if (_.isString(this.options.collection)) {
                    this.collection = this.options.collection = new window[this.options.collection]();
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
            this.listenTo(this.collection, 'all', this.log);

            this.listenTo(this.collection, 'add', this.addElement);
            this.listenTo(this.collection, 'remove', this.removeElement);
            this.listenTo(this.collection, 'hide', this.hideElement);
            this.listenTo(this.collection, 'show', this.showElement);
            this.listenTo(this.collection, 'sync', this.renderFooter);
            this.listenTo(this.collection, 'reset', this.render);

            // And add the css
            this.$el.addClass("tb-collection");
        },

        log: function () {
            console.log(arguments)
        },

        navigate: function (event) {
            var $target = $(event.currentTarget),
                self = this,
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

        renderElements: function (options) {
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
         * @param options
         */
        renderFooter: function (options) {
            var self = this,
                collection = this.collection;

            var info = {
                page: collection.page || 1,
                page_length: collection.page_length,
                total_pages: collection.total_pages || 0
            };

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

            self.$el.find("footer").remove();
            self.$el.append($footer);
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

    // Facile elements with backbone-forms
    $('[data-collection][data-require]').each(function () {
        var $view = $(this);

        require($(this).data('require').split(" "), function () {
            $view.tbcollection($view.data())
        });
    });
    $('[data-collection]:not([data-require])').each(function () {
        var $view = $(this);
        $view.tbcollection($view.data());
    });

    return Tornado;
}).call(window);
