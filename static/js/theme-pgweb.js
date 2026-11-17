/*
 * Ace theme "pgweb": the same rules as Ace's "Tomorrow" theme, but every
 * colour comes from the --editor-* variables in static/css/themes.css, so
 * the editor follows the active page theme without a theme switch in Ace.
 */
ace.define("ace/theme/pgweb", ["require", "exports", "module", "ace/lib/dom"], function(require, exports, module) {
  exports.isDark = false;
  exports.cssClass = "ace-pgweb";
  exports.cssText = "\
.ace-pgweb .ace_gutter { background: var(--editor-gutter-bg); color: var(--editor-gutter-fg) }\
.ace-pgweb .ace_print-margin { width: 1px; background: var(--editor-gutter-bg) }\
.ace-pgweb { background-color: var(--editor-bg); color: var(--editor-fg) }\
.ace-pgweb .ace_cursor { color: var(--editor-cursor) }\
.ace-pgweb .ace_marker-layer .ace_selection { background: var(--editor-selection) }\
.ace-pgweb.ace_multiselect .ace_selection.ace_start { box-shadow: 0 0 3px 0px var(--editor-bg) }\
.ace-pgweb .ace_marker-layer .ace_step { background: rgb(255, 255, 0) }\
.ace-pgweb .ace_marker-layer .ace_bracket { margin: -1px 0 0 -1px; border: 1px solid var(--editor-bracket) }\
.ace-pgweb .ace_marker-layer .ace_active-line { background: var(--editor-active-line) }\
.ace-pgweb .ace_gutter-active-line { background-color: var(--editor-gutter-active-line) }\
.ace-pgweb .ace_marker-layer .ace_selected-word { border: 1px solid var(--editor-selection) }\
.ace-pgweb .ace_invisible { color: var(--editor-bracket) }\
.ace-pgweb .ace_keyword, .ace-pgweb .ace_meta, .ace-pgweb .ace_storage, .ace-pgweb .ace_storage.ace_type, .ace-pgweb .ace_support.ace_type { color: var(--editor-keyword) }\
.ace-pgweb .ace_keyword.ace_operator { color: var(--editor-operator) }\
.ace-pgweb .ace_constant.ace_character, .ace-pgweb .ace_constant.ace_language, .ace-pgweb .ace_constant.ace_numeric, .ace-pgweb .ace_keyword.ace_other.ace_unit, .ace-pgweb .ace_support.ace_constant, .ace-pgweb .ace_variable.ace_parameter { color: var(--editor-constant) }\
.ace-pgweb .ace_constant.ace_other { color: var(--editor-fg) }\
.ace-pgweb .ace_invalid { color: var(--accent-fg); background-color: var(--danger) }\
.ace-pgweb .ace_invalid.ace_deprecated { color: var(--accent-fg); background-color: var(--editor-keyword) }\
.ace-pgweb .ace_fold { background-color: var(--editor-function); border-color: var(--editor-fg) }\
.ace-pgweb .ace_entity.ace_name.ace_function, .ace-pgweb .ace_support.ace_function, .ace-pgweb .ace_variable { color: var(--editor-function) }\
.ace-pgweb .ace_support.ace_class, .ace-pgweb .ace_support.ace_type { color: var(--editor-type) }\
.ace-pgweb .ace_heading, .ace-pgweb .ace_markup.ace_heading, .ace-pgweb .ace_string { color: var(--editor-string) }\
.ace-pgweb .ace_entity.ace_name.ace_tag, .ace-pgweb .ace_entity.ace_other.ace_attribute-name, .ace-pgweb .ace_meta.ace_tag, .ace-pgweb .ace_string.ace_regexp, .ace-pgweb .ace_variable { color: var(--editor-variable) }\
.ace-pgweb .ace_comment { color: var(--editor-comment) }\
.ace-pgweb .ace_indent-guide { background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAE0lEQVQImWP4////f4bdu3f/BwAlfgctduB85QAAAABJRU5ErkJggg==) right repeat-y }\
";

  var dom = require("../lib/dom");
  dom.importCssString(exports.cssText, exports.cssClass);
});
