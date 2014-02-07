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