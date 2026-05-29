import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Motion } from '@capacitor/motion';
import { Platform, AlertController } from '@ionic/angular';
import { App } from '@capacitor/app';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  // Raw values from sensor
  x = 0; // gamma (left/right)
  y = 0; // beta (front/back)

  // Calibration offsets
  offsetX = 0;
  offsetY = 0;

  // Display values (calibrated)
  displayX = 0;
  displayY = 0;
  degree = 0;

  // Bubble status for colors
  bubbleStatus: 'green' | 'yellow' | 'red' = 'red';

  // Bubble position in percentage for CSS
  bubbleX = 50;
  bubbleY = 50;

  listener: any;
  isVertical = false;
  private backButtonSubscription?: Subscription;

  constructor(
    private ngZone: NgZone,
    private platform: Platform,
    private alertController: AlertController
  ) { }

  async ngOnInit() {
    this.startSensors();
    this.setupBackButton();
  }

  setupBackButton() {
    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(10, async () => {
      await this.showExitConfirmation();
    });
  }

  async showExitConfirmation() {
    const alert = await this.alertController.create({
      header: 'Keluar Aplikasi',
      message: 'Apakah Anda yakin ingin keluar dari Penyeimbang-Ku?',
      cssClass: 'custom-exit-alert',
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: 'Keluar',
          role: 'confirm',
          cssClass: 'alert-button-confirm',
          handler: () => {
            App.exitApp();
          }
        }
      ]
    });

    await alert.present();
  }

  async startSensors() {
    try {
      // For iOS 13+ devices
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response !== 'granted') {
          console.warn('Permission to access device orientation was denied');
          return;
        }
      }

      this.listener = await Motion.addListener('orientation', (event) => {
        this.ngZone.run(() => {
          this.processMotion(event.gamma, event.beta);
        });
      });
    } catch (e) {
      console.error('Motion sensor not available', e);
    }
  }

  processMotion(gamma: number, beta: number) {
    this.x = gamma;
    this.y = beta;

    // Calculate calibrated values
    this.displayX = Number((this.x - this.offsetX).toFixed(1));
    this.displayY = Number((this.y - this.offsetY).toFixed(1));

    // Calculate degree magnitude
    this.degree = Number(Math.sqrt(Math.pow(this.displayX, 2) + Math.pow(this.displayY, 2)).toFixed(1));

    // Update bubble status based on degree
    if (this.degree < 0.2) {
      this.bubbleStatus = 'green';
    } else if (this.degree <= 20.0) {
      this.bubbleStatus = 'yellow';
    } else {
      this.bubbleStatus = 'red';
    }

    // Calculate bubble position with circular clamping
    const sensitivity = 45;
    let dx = (this.displayX / sensitivity) * 50;
    let dy = (this.displayY / sensitivity) * 50;

    // Keep bubble inside the 280px circle (radius 140px)
    // Bubble radius is 30px, so max center offset is 110px
    // In percentage: (110 / 280) * 100 = ~39.3%
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = 39;

    if (distance > maxDistance) {
      const ratio = maxDistance / distance;
      dx *= ratio;
      dy *= ratio;
    }

    this.bubbleX = 50 + dx;
    this.bubbleY = 50 + dy;
  }

  clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  calibrate() {
    this.offsetX = this.x;
    this.offsetY = this.y;
  }

  resetCalibration() {
    this.offsetX = 0;
    this.offsetY = 0;
  }

  toggleMode() {
    this.isVertical = !this.isVertical;
  }

  ngOnDestroy() {
    if (this.listener) {
      this.listener.remove();
    }
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
  }
}
