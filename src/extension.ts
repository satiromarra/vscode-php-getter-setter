'use strict';

import * as vscode from 'vscode';
import Redirector from "./Redirector";
import Property from "./Property";
import Configuration from "./Configuration";
import BracketFinder from "./BracketFinder";

interface configOptions {
  setter: boolean,
  getter: boolean,
  editor: vscode.TextEditor
}

interface configTemplate {
  html: string,
  label: string
}

class Resolver {
  config: Configuration;

  public constructor() {
    const editor = this.activeEditor();
    if (editor.document.languageId !== 'php') {
      throw new Error('Not a PHP file.');
    }
    this.config = new Configuration;
  }

  loadConfig() {
    this.config.load();
  }

  activeEditor() {
    return vscode.window.activeTextEditor;
  }

  closingClassLine() {
    const editor = this.activeEditor();
    const position = editor.selection.active;
    let closingBracketLine = editor.document.lineAt(BracketFinder.fromPosition(position)[1].line);
    return closingBracketLine;
  }

  insertGetterAndSetter() {
    this.insertGetterAndSetterTemplate({
      getter: true,
      setter: true,
      editor: this.activeEditor()
    });
  }
  insertGetter() {
    this.insertGetterAndSetterTemplate({
      getter: true,
      setter: false,
      editor: this.activeEditor()
    });
  }
  insertIfNotExists(editor: vscode.TextEditor, range: vscode.Position[], tpl: configTemplate): string {
    let add = true, curLine: vscode.TextLine;
    for (let inx = range[0].line; inx <= range[1].line; ++inx) {
      curLine = editor.document.lineAt(inx);
      if (curLine.text.includes(tpl.label)) {
        add = false;
        break;
      }
    }
    return add ? tpl.html : "";
  };
  insertGetterAndSetterTemplate(options: configOptions) {
    if (!options.setter && !options.getter) {
      return;
    }
    const editor = options.editor;
    let property = null;
    let content = '';
    let sgt: configTemplate;
    let range = BracketFinder.fromPosition(editor.selection.active, editor);
    for (let index = 0; index < editor.selections.length; index++) {
      const selection = editor.selections[index];
      for (let ind = selection.start.line; ind <= selection.end.line; ++ind) {
        sgt = null;
        let curLine = editor.document.lineAt(ind);
        let lastCharPos = new vscode.Position(curLine.lineNumber, Math.max(curLine.text.length - 1, 0));
        try {
          // property = Property.fromEditorPosition(editor, selection.active);
          property = Property.fromEditorPosition(editor, lastCharPos);
        } catch (error) {
          this.showErrorMessage(error.message);
          return null;
        }
        if (options.getter) {
          sgt = this.getterTemplate(property);
          content += this.insertIfNotExists(editor, range, sgt);
        }
        if (options.setter) {
          sgt = this.setterTemplate(property);
          content += this.insertIfNotExists(editor, range, sgt);
        }
      }
    }

    this.renderTemplate(content);
  }

  insertSetter() {
    this.insertGetterAndSetterTemplate({
      getter: false,
      setter: true,
      editor: this.activeEditor()
    });
  }

  getterTemplate(prop: Property): configTemplate {
    const name = prop.getName();
    const tab = prop.getIndentation();
    const type = prop.getType();
    const isStatic = prop.getIsStatic();
    let obj: configTemplate = {
      html: "",
      label: ""
    };

    obj.label = `public` + (isStatic ? ` static` : ``) + ` function ` + prop.getterName() + `()`;
    if (true === this.config.get('short', true)) {
      obj.html = (
        `\n`
        + tab + obj.label + (type ? `: ` + type + ` ` : ``) + `{ return` + (isStatic ? ` self::$` : ` $this->`) + name + `; }\n`
      );
    } else {
      obj.html = (
        `\n`
        + tab + `/**\n`
        + tab + ` * ` + prop.getterDescription() + `\n`
        + (type ? tab + ` *\n` : ``)
        + (type ? tab + ` * @return ` + type + `\n` : ``)
        + tab + ` */\n`
        + tab + obj.label + (type ? `: ` + type : ``));
      if (true === this.config.get("newlineopenbrace", false)) {
        obj.html += (`\n` + tab);
      } else {
        obj.html += (` `);
      }
      obj.html += (`{\n`
        + tab + tab + `return` + (isStatic ? ` self::$` : ` $this->`) + name + `;\n`
        + tab + `}\n`
      );
    }

    return obj;
  }

  setterTemplate(prop: Property): configTemplate {
    const name = prop.getName();
    const description = prop.getDescription();
    const tab = prop.getIndentation();
    const type = prop.getType();

    const isStatic = prop.getIsStatic();
    const showType = type && !isStatic;
    let obj: configTemplate = {
      label: "",
      html: ""
    }
    obj.label = `public` + (isStatic ? ` static` : ``) + ` function ` + prop.setterName() + `(`;
    if (true === this.config.get('short', true)) {
      obj.html = (
        tab + obj.label + (type ? type + ` ` : ``) + `$` + name + `)` + (isStatic ? ` { self::$` : `: self { $this->`) + name + ` = $` + name + `;` + (isStatic ? `` : ` return $this;`) + ` }\n`
      );
    } else {
      obj.html = (
        `\n`
        + tab + `/**\n`
        + tab + ` * ` + prop.setterDescription() + `\n`
        + (type ? tab + ` *\n` : ``)
        + (type ? tab + ` * @param ` + type + ` $` + name + (description ? `  ` + description : ``) + `\n` : ``)
        + (showType ? tab + ` *\n` : ``)
        + (showType ? tab + ` * @return self` + `\n` : ``)
        + tab + ` */\n`
        + tab + obj.label + (type ? type + ` ` : ``) + `$` + name + `)` + (isStatic ? `` : `: self`));
      if (true === this.config.get("newlineopenbrace", false)) {
        obj.html += (`\n` + tab);
      } else {
        obj.html += (` `);
      }
      obj.html += (`{\n`
        + tab + tab + (isStatic ? `self::$` : `$this->`) + name + ` = $` + name + `;`
        + (isStatic ? `` : `\n` + tab + tab + `return $this;`) + `\n`
        + tab + `}\n`
      );
    }

    return obj;
  }

  renderTemplate(template: string) {
    if (!template) {
      this.showErrorMessage('Missing template to render.');
      return;
    }

    let insertLine = this.insertLine();

    if (!insertLine) {
      this.showErrorMessage('Unable to detect insert line for template.');
      return;
    }

    const editor = this.activeEditor();
    let resolver = this;

    editor.edit(function (edit: vscode.TextEditorEdit) {
      edit.replace(
        new vscode.Position(insertLine.lineNumber, 0),
        template
      );
    }).then(
      success => {
        if (resolver.isRedirectEnabled() && success) {
          const redirector = new Redirector(editor);
          redirector.goToLine(this.closingClassLine().lineNumber - 1);
        }
      },
      error => {
        this.showErrorMessage(`Error generating functions: ` + error);
      }
    );
  }

  insertLine() {
    return this.closingClassLine();
  }

  isRedirectEnabled(): boolean {
    return true === this.config.get('redirect', false);
  }

  showErrorMessage(message: string) {
    message = 'phpGetterSetter error: ' + message.replace(/\$\(.+?\)\s\s/, '');

    vscode.window.showErrorMessage(message);
  }

  showInformationMessage(message: string) {
    message = 'phpGetterSetter info: ' + message.replace(/\$\(.+?\)\s\s/, '');

    vscode.window.showInformationMessage(message);
  }
}

function activate(context: vscode.ExtensionContext) {
  let resolver = new Resolver;
  let configurationChanged = vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => resolver.loadConfig());
  let insertGetter = vscode.commands.registerCommand('phpGetterSetter.insertGetter', () => resolver.insertGetter());
  let insertSetter = vscode.commands.registerCommand('phpGetterSetter.insertSetter', () => resolver.insertSetter());
  let insertGetterAndSetter = vscode.commands.registerCommand('phpGetterSetter.insertGetterAndSetter', () => resolver.insertGetterAndSetter());

  context.subscriptions.push(configurationChanged);
  context.subscriptions.push(insertGetter);
  context.subscriptions.push(insertSetter);
  context.subscriptions.push(insertGetterAndSetter);
}

function deactivate() {
}

exports.activate = activate;
exports.deactivate = deactivate;
