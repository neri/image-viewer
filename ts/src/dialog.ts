/*
    Dialog
*/

const $ = (x: string) => document.querySelector(x);

export class Dialog {

    private static _lastIndex = 0;
    private static _stack: Dialog[] = [];

    isModal: boolean;
    selector: string;

    outerElement: HTMLElement;
    frameElement: HTMLElement;
    bodyElement: HTMLElement;

    constructor(
        mainId: string,
        title: string,
        isModal: boolean = true,
        closeButton: boolean = true
    ) {
        const selector = `#${mainId}`;
        const targetElement = $(selector) as HTMLElement | null;
        if (targetElement === null) {
            throw new Error(`selector (${selector}) is not found`);
        }
        this.selector = selector;
        this.isModal = isModal;

        if (targetElement.className === "dialogOuter") {
            const frameElement = targetElement.firstElementChild as HTMLElement;
            const bodyElement = targetElement.querySelector('.dialogBody') as HTMLElement;
            this.outerElement = targetElement;
            this.frameElement = frameElement;
            this.bodyElement = bodyElement;
        } else {
            targetElement.removeAttribute('id');
            targetElement.className = 'dialogBody';

            const outerElement = document.createElement('div');
            outerElement.id = mainId;
            outerElement.className = 'dialogOuter';
            outerElement.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.isModal) {
                    Dialog.dismissTop();
                }
            });

            const frameElement = document.createElement('div');
            frameElement.className = 'dialogFrame';
            frameElement.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            outerElement.appendChild(frameElement);


            const titleElement = document.createElement('div');
            frameElement.appendChild(titleElement);

            targetElement.parentNode?.replaceChild(outerElement, targetElement);
            frameElement.appendChild(targetElement);

            this.outerElement = outerElement;
            this.frameElement = frameElement;
            this.bodyElement = targetElement;
        }

        {
            const titleElement = document.createElement('div');
            titleElement.className = 'dialogTitle';

            const titleString = document.createElement('div');
            titleString.className = 'dialogTitleContent';
            titleString.appendChild(document.createTextNode(title));
            titleElement.insertBefore(titleString, null);

            if (closeButton) {
                const closeButton = document.createElement('a');
                closeButton.classList.add('buttonFace', 'dialogCloseButton');
                closeButton.appendChild(document.createTextNode('\u{2715}'))
                closeButton.addEventListener('click', () => {
                    Dialog.dismissTop()
                })
                titleElement.insertBefore(closeButton, null);
            }

            this.frameElement.replaceChild(titleElement, this.frameElement.firstChild as HTMLElement);
        }

        this.onResetStyle();
    }

    onResetStyle() {
        this.frameElement.style.opacity = '0.0';
        this.frameElement.style.transform = 'translate(-50%, -50%) scale(1.125)';
    }

    onShow() {
        setTimeout(() => {
            this.frameElement.style.opacity = '1.0';
            this.frameElement.style.transform = 'translate(-50%, -50%) scale(1.0)';
        }, 50);
    }

    onClose() { }

    show() {
        Dialog._show(this)
    }
    private static _show(dialog: Dialog) {
        if (dialog.outerElement.style.display === 'block') return;

        if (Dialog._stack.length == 0) {
            Dialog._lastIndex = 100;
        }
        Dialog._stack.push(dialog)
        dialog.outerElement.style.zIndex = "" + (++Dialog._lastIndex)
        dialog.outerElement.style.display = 'block';
        dialog.onShow();
        setTimeout(() => {
            dialog.outerElement.style.backgroundColor = "rgba(0, 0, 0, 0.25)";
        }, 10);
    }

    dismiss() {
        Dialog._dismiss(this)
    }
    static _dismiss(dialog: Dialog) {
        Dialog._stack = Dialog._stack.filter(value => {
            if (value.selector === dialog.selector) {
                this._close(value)
                return false;
            } else {
                return true;
            }
        })
    }
    private static _close(dialog: Dialog) {
        dialog.onClose();
        dialog.outerElement.style.backgroundColor = "transparent";
        dialog.onResetStyle();
        setTimeout(() => {
            dialog.outerElement.style.display = 'none';
        }, 300);
    }

    static dismissAll() {
        while (Dialog._stack.length > 0) {
            this.dismissTop()
        }
    }
    static dismissTop() {
        const top = Dialog._stack.pop();
        if (top !== undefined) {
            this._close(top);
        }
    }

    childElement(selector: string): HTMLElement | null {
        return $(`${this.selector} ${selector}`) as HTMLElement | null
    }
}