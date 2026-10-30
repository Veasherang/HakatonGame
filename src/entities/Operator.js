/**
 * Оператор бункера — силуэт со спины.
 * Дышит, поворачивает голову, постукивает пальцами и пьёт кофе.
 * Никогда не поворачивается к игроку лицом.
 */

export class Operator extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.tense = false;
    this.sip = 0;
    this.sipping = false;
    this.nextSipAt = scene.time.now + 9000 + Math.random() * 12000;
    this.tapPhase = 0;
    this.steam = [];

    this.backGlow = scene.add.ellipse(0, -84, 300, 190, 0x2d5a5a, 0.03);
    this.add(this.backGlow);

    this.chairG = scene.add.graphics();
    this.add(this.chairG);
    this.drawChair();

    this.bodyG = scene.add.graphics();
    this.add(this.bodyG);
    this.drawBody();

    this.headC = scene.add.container(0, -104);
    this.headG = scene.add.graphics();
    this.headC.add(this.headG);
    this.drawHead();
    this.add(this.headC);

    this.leftArmG = scene.add.graphics();
    this.add(this.leftArmG);

    this.armG = scene.add.graphics();
    this.add(this.armG);

    this.mugC = scene.add.container(128, 34);
    this.mugG = scene.add.graphics();
    this.mugC.add(this.mugG);
    this.drawMug();
    this.add(this.mugC);

    this.steamG = scene.add.graphics();
    this.add(this.steamG);

    this.setDepth(12);
    scene.add.existing(this);

    this.breathTween = scene.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: 5200,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.lookTween = scene.tweens.addCounter({
      from: -1,
      to: 1,
      duration: 7300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  drawChair() {
    const g = this.chairG;
    g.clear();
    g.fillStyle(0x05090b, 1);
    g.fillRoundedRect(-148, -26, 296, 220, 14);
    g.fillStyle(0x080f11, 1);
    g.fillRoundedRect(-134, -18, 268, 200, 12);
    g.lineStyle(1, 0x2f5558, 0.65);
    g.strokeRoundedRect(-148, -26, 296, 220, 14);
    g.lineStyle(3, 0x3a7273, 0.55);
    g.lineBetween(-120, -26, 120, -26);
  }

  drawBody() {
    const g = this.bodyG;
    g.clear();
    // Контур для читаемости на тёмном фоне.
    g.fillStyle(0x2a5557, 0.5);
    g.beginPath();
    g.moveTo(-117, 26);
    g.lineTo(-101, -48);
    g.lineTo(-56, -74);
    g.lineTo(56, -74);
    g.lineTo(101, -48);
    g.lineTo(117, 26);
    g.lineTo(140, 212);
    g.lineTo(-140, 212);
    g.closePath();
    g.fillPath();

    // Торс.
    g.fillStyle(0x0e181b, 1);
    g.beginPath();
    g.moveTo(-112, 24);
    g.lineTo(-96, -46);
    g.lineTo(-54, -70);
    g.lineTo(54, -70);
    g.lineTo(96, -46);
    g.lineTo(112, 24);
    g.lineTo(136, 210);
    g.lineTo(-136, 210);
    g.closePath();
    g.fillPath();

    // Капюшон/воротник.
    g.fillStyle(0x080f11, 1);
    g.fillRoundedRect(-62, -84, 124, 30, 12);

    // Свет монитора на плечах.
    g.lineStyle(2, 0x4d8684, 0.85);
    g.lineBetween(-98, -45, -54, -69);
    g.lineBetween(54, -69, 98, -45);
    g.lineStyle(1, 0x63a29c, 0.5);
    g.lineBetween(-108, -33, -84, -57);
    g.lineBetween(108, -33, 84, -57);

    // Складки одежды.
    g.lineStyle(1, 0x111f22, 1);
    g.lineBetween(-30, -40, -18, 90);
    g.lineBetween(35, -38, 22, 110);

    // Шея.
    g.fillStyle(0x080f11, 1);
    g.fillRect(-15, -88, 30, 18);
  }

  drawHead() {
    const g = this.headG;
    g.clear();

    // Контур головы.
    g.fillStyle(0x2a5557, 0.45);
    g.fillRoundedRect(-41, -39, 82, 92, 29);

    g.fillStyle(0x0f1a1d, 1);
    g.fillRoundedRect(-38, -36, 76, 86, 26);

    // Волосы.
    g.fillStyle(0x081012, 1);
    g.fillRoundedRect(-37, -38, 74, 30, 16);

    // Световое ребро от монитора.
    g.lineStyle(2, 0x66a7a1, 0.95);
    g.beginPath();
    g.arc(-2, -4, 36, Math.PI * 1.08, Math.PI * 1.62, false);
    g.strokePath();
    g.lineStyle(1, 0x8ac4ba, 0.4);
    g.beginPath();
    g.arc(-6, -6, 32, Math.PI * 1.15, Math.PI * 1.5, false);
    g.strokePath();

    // Наушники.
    g.lineStyle(3, 0x16262a, 1);
    g.beginPath();
    g.arc(0, -14, 40, Math.PI * 1.12, Math.PI * 1.88, false);
    g.strokePath();
    g.fillStyle(0x0d181b, 1);
    g.fillRoundedRect(-48, -18, 13, 32, 5);
    g.fillRoundedRect(35, -18, 13, 32, 5);
    g.fillStyle(0x4fa87e, 1);
    g.fillRect(-46, 4, 3, 3);
    g.fillRect(39, 4, 3, 3);

    // Затылок.
    g.fillStyle(0x0a1416, 1);
    g.fillRoundedRect(-22, 28, 44, 24, 10);
  }

  drawMug() {
    const g = this.mugG;
    g.clear();
    g.fillStyle(0x0c1416, 1);
    g.fillRoundedRect(-10, -12, 21, 20, 3);
    g.lineStyle(1, 0x3f6b68, 0.8);
    g.strokeRoundedRect(-10, -12, 21, 20, 3);
    g.fillStyle(0xb08a4a, 0.85);
    g.fillRect(-8, -11, 17, 3);
    g.lineStyle(2, 0x22403f, 1);
    g.beginPath();
    g.arc(12, -2, 6, -Math.PI / 2, Math.PI / 2, false);
    g.strokePath();
  }

  drawLeftArm(time) {
    const g = this.leftArmG;
    g.clear();
    // Плечо — локоть.
    g.lineStyle(16, 0x0a1214, 1);
    g.lineBetween(-96, -44, -128, 34);
    g.lineStyle(13, 0x0c1618, 1);
    g.lineBetween(-128, 34, -100, 74);

    // Кисть на подлокотнике.
    g.fillStyle(0x0e191b, 1);
    g.fillRoundedRect(-112, 70, 30, 14, 5);
    const tapping = Math.floor(time / 420) % 3;
    for (let i = 0; i < 3; i += 1) {
      const lift = i === tapping ? -2 : 0;
      g.fillRect(-108 + i * 8, 82 + lift, 5, 8);
    }
    g.lineStyle(1, 0x4a7e7b, 0.55);
    g.lineBetween(-96, -44, -128, 34);
  }

  drawArm(time) {
    const g = this.armG;
    g.clear();
    const shoulder = { x: 96, y: -44 };
    const target = this.mugC;

    // Плечо — кисть (тянется к кружке).
    const handX = target.x - 4;
    const handY = target.y + 6;
    g.lineStyle(17, 0x0a1214, 1);
    g.lineBetween(shoulder.x, shoulder.y, handX + 10, handY + 22);
    g.lineStyle(13, 0x0c1618, 1);
    g.lineBetween(handX + 10, handY + 22, handX, handY);
    g.lineStyle(1, 0x4a7e7b, 0.5);
    g.lineBetween(shoulder.x, shoulder.y, handX + 10, handY + 22);

    // Пальцы.
    g.fillStyle(0x0e191b, 1);
    g.fillRoundedRect(handX - 10, handY - 6, 18, 12, 4);
    for (let i = 0; i < 3; i += 1) {
      g.fillRect(handX + 2 + i * 4, handY - 2 - ((Math.floor(time / 600) + i) % 2), 3, 6);
    }
  }

  update(time) {
    const breath = this.breathTween.getValue() || 0;
    const look = this.lookTween.getValue() || 0;

    this.bodyG.y = Math.sin(breath) * 1.3;
    this.headC.y = -104 + Math.sin(breath + 0.6) * 1.6;
    this.headC.x = Math.sin(time / 6900) * 2.2 + look * 1.4;
    this.headC.rotation =
      Math.sin(time / 6100) * 0.018 + look * 0.012 + (this.tense ? -0.045 : 0);
    this.chairG.y = Math.sin(breath) * 0.4;

    this.drawLeftArm(time);
    this.drawArm(time);

    // Питьё кофе.
    if (!this.sipping && time > this.nextSipAt) {
      this.startSip();
    }
    if (this.sipping) {
      this.updateSip(time);
    } else {
      this.mugC.setPosition(128, 34 + Math.sin(breath) * 0.8);
      this.mugC.setRotation(0);
    }
  }

  startSip() {
    this.sipping = true;
    this.sip = 0;
    this.sipStarted = this.scene.time.now;
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1500,
      yoyo: true,
      hold: 1400,
      ease: 'Sine.inOut',
      onComplete: () => {
        this.sipping = false;
        this.sip = 0;
        this.nextSipAt = this.scene.time.now + 32000 + Math.random() * 26000;
        this.steamG.clear();
      },
      onUpdate: (tween) => {
        this.sip = tween.getValue();
      },
    });
  }

  updateSip(time) {
    const from = { x: 128, y: 34 };
    const to = { x: 44, y: -128 };
    const t = this.sip;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    this.mugC.setPosition(x, y);
    this.mugC.setRotation(-0.25 * t);

    this.steamG.clear();
    if (t > 0.35) {
      for (let i = 0; i < 5; i += 1) {
        const phase = ((time / 1300) + i * 0.23) % 1;
        const sx = x + Math.sin(phase * 6 + i) * 4;
        const sy = y - 16 - phase * 34;
        const alpha = (1 - phase) * 0.22 * t;
        this.steamG.fillStyle(0xb9d6cc, alpha);
        this.steamG.fillCircle(sx, sy, 2 + phase * 2.5);
      }
    }
  }

  setTense(value) {
    if (this.tense === value) return;
    this.tense = Boolean(value);
    this.scene.tweens.add({
      targets: this.headC,
      angle: this.tense ? -2 : 0,
      duration: 400,
      ease: 'Sine.out',
    });
  }
}
