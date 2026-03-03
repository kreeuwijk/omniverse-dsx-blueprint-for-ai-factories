import carb
from pxr import Usd


def switch_variant_architecture(stage, variant_set_name, variant_name, variant_cache=None):
    """
    Switch the variant in the given USD stage.

    Args:
        stage: The USD stage to modify
        variant_set_name: Name of the variant set to modify
        variant_name: Name of the variant to switch to
        variant_cache: Optional dict mapping prim paths to their variant set names

    Returns:
        bool: True if variant was successfully switched, False otherwise
    """
    if not stage:
        carb.log_info("[variant] No stage loaded.")
        return False

    carb.log_info(f"[variant] Looking for variant set '{variant_set_name}' with variant '{variant_name}'")
    variant_switched = False

    if variant_cache is not None:
        prims_to_switch = []
        for prim_path, vs_names in variant_cache.items():
            if variant_set_name in vs_names:
                prim = stage.GetPrimAtPath(prim_path)
                if prim and prim.IsValid():
                    prims_to_switch.append(prim)
    else:
        # Original traversal fallback
        prims_to_switch = []
        for prim in stage.Traverse():
            vs_names = prim.GetVariantSets().GetNames()
            if variant_set_name in vs_names:
                prims_to_switch.append(prim)

    for prim in prims_to_switch:
        variant_sets = prim.GetVariantSets()
        variant_set = variant_sets.GetVariantSet(variant_set_name)
        variants = variant_set.GetVariantNames()

        carb.log_verbose(f"[variant] Found variant set '{variant_set_name}' on prim: {prim.GetPath()}")
        carb.log_verbose(f"[variant] Available variants: {variants}")

        authoring_layer = find_variantset_authoring_layer(prim, variant_set_name)
        carb.log_verbose(f"[variant] Authoring Layer for {variant_set_name}: {authoring_layer}")

        if authoring_layer:
            prev_edit_target = stage.GetEditTarget()
            stage.SetEditTarget(Usd.EditTarget(authoring_layer))

            try:
                if switch_variant_selection(prim, variant_set, variants, variant_name):
                    variant_switched = True
            finally:
                stage.SetEditTarget(prev_edit_target)
        else:
            carb.log_info(
                f"[variant] Could not find authoring layer for {variant_set_name} on {prim.GetPath()}"
            )

    if not variant_switched:
        carb.log_info(f"[variant] Warning: Variant set '{variant_set_name}' or variant '{variant_name}' not found")

    return variant_switched


def find_variantset_authoring_layer(prim, variant_set_name):
    """
    Find the layer where the variant set is authored.

    Args:
        prim: The prim to search
        variant_set_name: Name of the variant set

    Returns:
        Sdf.Layer or None
    """
    for spec in prim.GetPrimStack():
        layer = spec.layer
        sdf_prim = layer.GetPrimAtPath(prim.GetPath())
        if sdf_prim and variant_set_name in sdf_prim.variantSets.keys():
            return layer
    return None


def switch_variant_selection(prim, variant_set, variants, variant_name):
    """
    Switch the variant set to the specified variant.

    Args:
        prim: The prim to modify
        variant_set: The variant set object
        variants: List of available variant names
        variant_name: Name of the variant to switch to

    Returns:
        bool: True if variant was switched, False otherwise
    """
    if not variants:
        carb.log_verbose(f"[variant] No variants available for {prim.GetPath()}.")
        return False

    carb.log_verbose(f"[variant] Requested variant: {variant_name}")

    # Check if the requested variant exists
    if variant_name not in variants:
        carb.log_info(f"[variant] Variant '{variant_name}' not found in {variants}")
        return False

    carb.log_info(f"[variant] Switching {prim.GetPath()} to variant: {variant_name}")
    variant_set.SetVariantSelection(variant_name)
    return True
