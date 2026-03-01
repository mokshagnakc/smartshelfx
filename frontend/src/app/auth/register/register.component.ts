import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
    form: FormGroup;
    loading = false;
    showPass = false;
    errorMsg = '';

    constructor(
        private fb: FormBuilder,
        private auth: AuthService,
        private router: Router,
        private notify: NotificationService
    ) {
        this.form = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(2)]],
            username: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            role: ['', Validators.required],
            password: ['', [Validators.required, Validators.minLength(6)]]
        });
    }

    get f() { return this.form.controls; }

    submit() {
        this.errorMsg = '';
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.loading = true;

        const payload = {
            name: this.form.value.name.trim(),
            username: this.form.value.username.trim(),
            email: this.form.value.email.trim().toLowerCase(),
            role: this.form.value.role,
            password: this.form.value.password
        };

        this.auth.register(payload).subscribe({
            next: () => {
                this.notify.success('Account created! Please log in.');
                this.router.navigate(['/auth/login']);
            },
            error: (err) => {
                this.loading = false;
                const msg = err?.error?.error || err?.message || 'Registration failed. Please try again.';
                this.errorMsg = msg;
                this.notify.error(msg);
                console.error('[REGISTER ERROR]', err);
            }
        });
    }
}