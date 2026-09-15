import { Routes } from '@angular/router';
import { PaymentComponent } from './features/payment/payment.component';

export const routes: Routes = [
  {
    path: '',
    component: PaymentComponent,
    pathMatch: 'full'
  },
  {
    path: 'payment',
    component: PaymentComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];