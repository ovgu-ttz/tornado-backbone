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
