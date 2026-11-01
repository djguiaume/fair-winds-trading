/** What the title and the pause card share: a place to add a row before Settings. */
export interface MenuRows {
  addRow(id: string, label: string, press: () => void): void;
}
