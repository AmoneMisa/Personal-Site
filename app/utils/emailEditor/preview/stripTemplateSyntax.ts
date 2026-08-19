import type { TemplateEngine } from "./clientProfiles";

// Remove template-engine syntax from the PREVIEW only, so a template renders as
// an email instead of dumping macro definitions and comments as visible text.
//
// This is deliberately not a template engine: it does not evaluate conditions or
// expand macro calls. It strips the syntax while keeping the markup the tags
// wrap, which is what makes the preview readable:
//
//   * comments are dropped entirely (they are never output);
//   * directive tags are dropped but their body is kept, so a template whose
//     whole email lives inside <#macro ...> ... </#macro> still previews;
//   * user-directive calls (<@row ... />) are dropped, since the preview cannot
//     expand them and they would otherwise print as text.
//
// Templates that define several macros will show all of their bodies. The panel
// already tells the user the preview is approximate.

export function stripTemplateSyntax(code: string, engine: TemplateEngine): string {
    if (!code) return code;

    if (engine === "freemarker") {
        return code
            // <#-- comment --> (may span lines)
            .replace(/<#--[\s\S]*?-->/g, "")
            // <#if ...>, </#if>, <#macro ...>, </#macro>, <#list ...>, ...
            .replace(/<\/?#[a-zA-Z]+\b[^>]*>/g, "")
            // <@row ... />, <@sectionEnd />, </@compress>
            .replace(/<\/?@[^>]*>/g, "")
            .trim();
    }

    if (engine === "velocity") {
        return code
            // #* block comment *#
            .replace(/#\*[\s\S]*?\*#/g, "")
            // ## line comment
            .replace(/##[^\n]*/g, "")
            // #if(...) #elseif(...) #else #end #foreach(...) #set(...) #macro(...)
            .replace(/#(?:if|elseif|else|end|foreach|set|macro|parse|include|stop|break)\b(?:\s*\([^)]*\))?/gi, "")
            .trim();
    }

    return code;
}
