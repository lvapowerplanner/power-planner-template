type ConfirmHandler = (message: string) => Promise<boolean>;

let confirmHandler: ConfirmHandler | null = null;

export function registerAppConfirmHandler(handler: ConfirmHandler | null) {
  confirmHandler = handler;
}

export function appConfirm(message: string): Promise<boolean> {
  if (!confirmHandler) return Promise.resolve(false);
  return confirmHandler(message);
}
