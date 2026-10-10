import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  /** `danger` for irreversible actions (delete, reject). */
  tone?: 'primary' | 'danger';
}

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dialog' },
  template: `
    <h2 class="dialog__title" id="confirm-title">{{ data.title }}</h2>
    <p class="dialog__body text-secondary">{{ data.message }}</p>
    <div class="dialog__actions">
      <button type="button" class="btn" (click)="ref.close(false)">Cancel</button>
      <button
        type="button"
        class="btn"
        [class.btn--danger]="data.tone === 'danger'"
        [class.btn--primary]="data.tone !== 'danger'"
        (click)="ref.close(true)"
        cdkFocusInitial
      >
        {{ data.confirmLabel }}
      </button>
    </div>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(Dialog);

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<boolean, ConfirmOptions>(ConfirmDialog, {
      data: options,
      width: '420px',
      maxWidth: 'calc(100vw - 32px)',
      ariaLabelledBy: 'confirm-title',
      role: 'alertdialog',
      backdropClass: 'cdk-overlay-dark-backdrop',
    });
    return (await firstValueFrom(ref.closed)) === true;
  }
}
