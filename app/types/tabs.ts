export interface TabsItem<T extends string | number = string | number> {
  label: string;
  value?: T;
}
