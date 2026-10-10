import { Dialog } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Opens a form dialog with shared settings; resolves to the saved value or `undefined`. */
@Injectable({ providedIn: 'root' })
export class FormDialogService {
  private readonly dialog = inject(Dialog);

  open<R, D>(
    component: ComponentType<unknown>,
    data: D,
    labelledBy: string,
  ): Promise<R | undefined> {
    const ref = this.dialog.open<R, D>(component, {
      data,
      width: '480px',
      maxWidth: 'calc(100vw - 32px)',
      ariaLabelledBy: labelledBy,
      backdropClass: 'cdk-overlay-dark-backdrop',
    });
    return firstValueFrom(ref.closed);
  }
}
