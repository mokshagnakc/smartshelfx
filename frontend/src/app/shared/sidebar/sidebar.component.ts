import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';

interface NavItem {
    label: string;
    icon: string;
    route: string;
    roles?: string[];
}

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, RouterModule, RouterLinkActive],
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
    @Input() collapsed = false;
    @Output() toggle = new EventEmitter<void>();

    constructor(public auth: AuthService) { }

    navItems: NavItem[] = [
        { label: 'Dashboard', icon: '📊', route: '/dashboard' },
        { label: 'Inventory', icon: '📦', route: '/inventory' },
        { label: 'Transactions', icon: '🔄', route: '/transactions' },
        { label: 'AI Forecasting', icon: '🤖', route: '/forecasting' },
        { label: 'Purchase Orders', icon: '🛒', route: '/orders' },
        { label: 'Alerts', icon: '🔔', route: '/alerts' },
        { label: 'Analytics', icon: '📈', route: '/analytics' },
    ];

    onToggle() { this.toggle.emit(); }
    logout() { this.auth.logout(); }
}