/**
 * Рынок контрактов: генерация предложений, отправка существ,
 * расчёт результата и последствий. Без DOM и Phaser.
 */
import { BALANCE, clamp } from '../config/balance.js';
import { COMPANY_LIST, getCompany } from '../data/companies.js';
import {
  addXp,
  applyContractResult,
  contractBonus,
  creatureDef,
  incomeMultiplier,
  readiness,
} from './creatures.js';

let offerCounter = 0;

function nextOfferId() {
  offerCounter += 1;
  return `offer_${Date.now().toString(36)}_${offerCounter}`;
}

/** Сгенерировать предложения на смену. */
export function generateOffers(state, rng) {
  const pairs = [];
  for (const company of COMPANY_LIST) {
    for (const template of company.templates) {
      pairs.push({ company, template });
    }
  }
  const shuffled = rng.shuffle(pairs);
  const offers = [];

  for (let index = 0; index < BALANCE.contract.offersPerShift && index < shuffled.length; index += 1) {
    const { company, template } = shuffled[index];
    const dayScale = 1 + (state.day - 1) * BALANCE.contract.payScalePerDay;
    const repScale = 1 + state.reputation * BALANCE.contract.payScalePerRep;
    const variance = 0.9 + rng.next() * 0.22;
    const pay = Math.max(80, Math.round((template.basePay * dayScale * repScale * variance) / 10) * 10);
    const duration = Math.round(template.duration * (0.85 + rng.next() * 0.3));
    const reqReadiness = clamp(
      template.readiness + (state.day - 1) * 1.15 + (state.reputation - 50) * 0.08,
      24,
      94
    );

    offers.push({
      id: nextOfferId(),
      companyId: company.id,
      companyName: company.name,
      specialization: company.specialization,
      color: company.color,
      logo: company.logo,
      suspicion: company.suspicion,
      title: template.title,
      profession: template.profession,
      pay,
      duration,
      risk: template.risk,
      reqReadiness: Math.round(reqReadiness),
      flavor: template.flavor,
      acceptedBy: null,
    });
  }

  return offers;
}

/** Можно ли отправить существо по контракту. */
export function canAcceptOffer(creature, offer) {
  if (!creature || !creature.stats) return { ok: false, reason: 'Существо недоступно' };
  if (creature.status === 'contract') return { ok: false, reason: 'Уже на контракте' };
  if (creature.status === 'terminated') return { ok: false, reason: 'Существо утилизировано' };
  if (creature.status === 'escaped') return { ok: false, reason: 'Существо сбежало' };
  if (creature.status === 'empty') return { ok: false, reason: 'Пустая клетка' };
  if (creature.status === 'training') return { ok: false, reason: 'Идёт обучение' };
  if (creature.stats.health <= 20) return { ok: false, reason: 'Слишком плохое здоровье' };
  if (readiness(creature) < offer.reqReadiness) {
    return { ok: false, reason: `Недостаточная готовность (${readiness(creature)}/${offer.reqReadiness})` };
  }
  return { ok: true };
}

/** Отправить существо на работу. */
export function acceptContract(state, offer, creature, rng) {
  const check = canAcceptOffer(creature, offer);
  if (!check.ok) return check;

  const def = creatureDef(creature);
  creature.status = 'contract';
  creature.contract = {
    offerId: offer.id,
    companyId: offer.companyId,
    companyName: offer.companyName,
    title: offer.title,
    profession: offer.profession,
    pay: offer.pay,
    risk: offer.risk,
    reqReadiness: offer.reqReadiness,
    duration: offer.duration,
    endIn: offer.duration,
    day: state.day,
  };
  creature.activity = 'КОНТРАКТ';

  const offerIndex = state.offers.findIndex((item) => item.id === offer.id);
  if (offerIndex >= 0) state.offers.splice(offerIndex, 1);

  const professionMatch = def.professions.includes(offer.profession);
  return {
    ok: true,
    creature,
    offer,
    professionMatch,
    text: `${def.name} отправлен: ${offer.title} (${offer.companyName})`,
  };
}

/**
 * Обновление контрактов. Возвращает массив завершённых контрактов
 * с готовым расчётом выплат и последствий.
 */
export function tickContracts(state, dt, rng) {
  const completed = [];
  for (const creature of state.creatures) {
    if (creature.status !== 'contract' || !creature.contract) continue;
    creature.contract.endIn -= dt;
    if (creature.contract.endIn > 0) continue;

    const contract = creature.contract;
    const offer = { ...contract };
    const def = creatureDef(creature);
    const score =
      readiness(creature) +
      contractBonus(creature) +
      (def.professions.includes(contract.profession) ? 8 : 0) +
      rng.range(-10, 10) -
      contract.risk * 3;

    let outcome = 'fail';
    if (score >= contract.reqReadiness + 24) outcome = 'critical';
    else if (score >= contract.reqReadiness + 4) outcome = 'success';
    else if (score >= contract.reqReadiness - 12) outcome = 'partial';

    const incidentChance =
      0.018 + contract.risk * 0.012 + (creature.stats.loyalty < 30 ? 0.03 : 0);
    if (rng.chance(incidentChance)) outcome = 'incident';

    const basePay = contract.pay;
    const payoutScale = {
      critical: 1.35,
      success: 1,
      partial: 0.55,
      fail: 0,
      incident: 0.2,
    }[outcome];

    let payout = Math.round((basePay * payoutScale * incomeMultiplier(creature)) / 5) * 5;
    if (def.id === 'vodolazik' && contract.companyId === 'biotech' && outcome === 'critical') {
      payout = Math.round(payout * 1.15);
    }

    const repDelta = { critical: 4, success: 2.4, partial: -1.2, fail: -4, incident: -6 }[outcome];
    const biomass = { critical: 6, success: 3, partial: 1, fail: 0, incident: 0 }[outcome];
    const risk = contract.risk;
    const stressDelta = {
      critical: 6 + risk * 2,
      success: 11 + risk * 3,
      partial: 16 + risk * 4,
      fail: 22 + risk * 4,
      incident: 32 + risk * 4,
    }[outcome];
    const healthDelta = {
      critical: -1,
      success: -3 * risk,
      partial: -5 * risk,
      fail: -7 * risk,
      incident: -12 * risk,
    }[outcome];
    const loyaltyDelta = {
      critical: 3,
      success: 1,
      partial: -2,
      fail: -4,
      incident: -7,
    }[outcome];

    applyContractResult(creature, {
      stressDelta,
      healthDelta,
      loyaltyDelta,
      hungerDelta: contract.duration * 0.035,
      energyDelta: -8 - risk * 2,
      aggressionDelta: outcome === 'fail' || outcome === 'incident' ? 6 : 0,
    });

    const xpGain = Math.round(24 + contract.duration * 0.12 + risk * 8);
    const levelResult = addXp(creature, xpGain);

    // Редкое «неожиданное изменение» — мутация прямо на объекте.
    let changed = false;
    if (outcome === 'incident' && creature.stage < 3 && rng.chance(0.35)) {
      creature.stage += 1;
      changed = true;
    }

    const text = {
      critical: `${def.name}: контракт «${contract.title}» выполнен сверх плана. ${contract.companyName} довольна.`,
      success: `${def.name} вернулся с контракта «${contract.title}». Работа принята.`,
      partial: `${def.name} вернулся с контракта «${contract.title}». Заказчик снизил оплату.`,
      fail: `${def.name} не справился с «${contract.title}». Оплата не получена.`,
      incident: `${def.name}: потеря связи на объекте «${contract.title}». Существо вернулось повреждённым.`,
    }[outcome];

    completed.push({
      slot: creature.slot,
      defId: def.id,
      name: def.name,
      contract,
      outcome,
      payout,
      repDelta,
      biomass,
      xp: xpGain,
      levels: levelResult.levels,
      changed,
      suspicion: getCompany(contract.companyId)?.suspicion || 0,
      text,
    });

    creature.lastResult = { outcome, payout, day: state.day };
    creature.activity = 'ВЕРНУЛСЯ';
  }

  return completed;
}
