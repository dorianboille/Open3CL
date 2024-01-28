import enums from './enums.js'
import { tv, requestInput } from './utils.js'

function tv_k(di, de, du, pc_id, enveloppe) {
  const mur_list = enveloppe.mur_collection.mur
  const pb_list = enveloppe.plancher_bas_collection.plancher_bas
  const ph_list = enveloppe.plancher_haut_collection.plancher_haut
  const bv_list = enveloppe.baie_vitree_collection.baie_vitree
  const porte_list = enveloppe.porte_collection.porte

  let mur = mur_list.find(
    (mur) =>
      mur.donnee_entree.reference === de.reference_1 ||
      mur.donnee_entree.reference === de.reference_2
  )
  let type_isolation_mur = requestInput(mur.donnee_entree, mur.donnee_utilisateur, 'type_isolation')
  let pc = enums.periode_construction[pc_id]
  if (type_isolation_mur === 'inconnu') {
    if (['avant 1948', '1948-1974'].includes(pc)) type_isolation_mur = 'non isolé'
    else type_isolation_mur = 'iti'
  }

  let type_liaison = requestInput(de, du, 'type_liaison')
  let matcher = {
    enum_type_liaison_id: de.enum_type_liaison_id,
    isolation_mur: `^${type_isolation_mur}$` // prevent 'iti' from matching 'iti+ite
  }

  switch (type_liaison) {
    case 'plancher bas / mur':
    case 'plancher haut lourd / mur': {
      let plancher_list = ph_list.concat(pb_list)
      let plancher = plancher_list.find(
        (plancher) =>
          plancher.donnee_entree.reference === de.reference_1 ||
          plancher.donnee_entree.reference === de.reference_2
      )
      let isolation_plancher = requestInput(
        plancher.donnee_entree,
        plancher.donnee_utilisateur,
        'type_isolation'
      )
      matcher.isolation_plancher = `^${isolation_plancher}$`
      if (matcher.isolation_plancher.includes('inconnu')) {
        let type_adjacence_plancher = enums.type_adjacence[plancher.donnee_entree.type_adjacence_id]
        let cutoff
        if (type_adjacence_plancher === 'terre-plein')
          cutoff = ['avant 1948', '1948-1974', '1975-1977', '1978-1982', '1983-1988', '1989-2000']
        else cutoff = ['avant 1948', '1948-1974']

        if (cutoff.includes(pc)) matcher.isolation_plancher = 'non isolé'
        else matcher.isolation_plancher = '^ite$'
      }
      break
    }
    case 'plancher intermédiaire lourd / mur':
      // TODO
      break
    case 'refend / mur':
      // TODO
      break
    case 'menuiserie / mur': {
      let menuiserie_list = bv_list.concat(porte_list)
      let menuiserie = menuiserie_list.find(
        (men) =>
          men.donnee_entree.reference === de.reference_1 ||
          men.donnee_entree.reference === de.reference_2
      )
      if (!menuiserie)
        console.error('Did not find menuiserie reference:', de.reference_1, de.reference_2)
      let mde = menuiserie.donnee_entree
      let mdu = menuiserie.donnee_utilisateur

      matcher.type_pose = requestInput(mde, mdu, 'type_pose')
      matcher.presence_retour_isolation = requestInput(
        mde,
        mdu,
        'presence_retour_isolation',
        'bool'
      )
      matcher.largeur_dormant = requestInput(mde, mdu, 'largeur_dormant', 'float')
    }
  }

  const row = tv('pont_thermique', matcher)
  if (row) {
    di.k = Number(row.k)
    de.tv_pont_thermique_id = Number(row.tv_pont_thermique_id)
  } else {
    console.error('!! pas de valeur forfaitaire trouvée pour pont_thermique (k) !!')
  }
}

export default function calc_pont_thermique(pt, pc_id, enveloppe) {
  let de = pt.donnee_entree
  let di = {}
  let du = {}

  let methode_saisie_pont_thermique = requestInput(de, du, 'methode_saisie_pont_thermique')

  switch (methode_saisie_pont_thermique) {
    case 'valeur forfaitaire':
      tv_k(di, de, du, pc_id, enveloppe)
      break
    case 'valeur justifiée saisie à partir des documents justificatifs autorisés':
      di.k = requestInput(de, du, 'k', 'float')
      break
    case 'saisie direct k depuis rset/rsee( etude rt2012/re2020)':
      break
    default:
      console.error('methode_saisie_pont_thermique non reconnu:' + methode_saisie_pont_thermique)
  }

  pt.donnee_utilisateur = du
  pt.donnee_intermediaire = di
}
