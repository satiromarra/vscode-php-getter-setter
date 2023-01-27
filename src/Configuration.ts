'use strict';

import * as vscode from 'vscode';

export default class Configuration {
  private config: vscode.WorkspaceConfiguration;

  public constructor() {
    this.load();
  }
  load() {
    this.config = vscode.workspace.getConfiguration('phpGetterSetter');
  }
  get(key: string, defaultValue) {
    return this.config.get(key, defaultValue);
  }

  getInt(key: string, defaultValue: number): number {
    return parseInt(this.get(key, defaultValue));
  }

  getBool(key: string, defaultValue: boolean): boolean {
    return parseInt(this.get(key, defaultValue)) == 1;
  }
}
