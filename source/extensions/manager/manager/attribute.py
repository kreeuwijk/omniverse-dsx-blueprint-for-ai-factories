####
# USD helper functions to be imported by extension.py
####

from pxr import Usd, Sdf


def set_prim_attribute(stage: Usd.Stage, prim_path: str, attr_name: str, value):
    """
    Set a prim attribute value by prim path and attribute name.

    Args:
        stage: The USD stage
        prim_path: Full path to the prim (e.g. "/World/.../VolumeShader")
        attr_name: Attribute name (e.g. "inputs:load_level")
        value: The value to set (will be converted based on the attribute's type)

    Returns:
        bool: True if the attribute was set successfully, False otherwise
    """
    prim = stage.GetPrimAtPath(prim_path)
    if not prim or not prim.IsValid():
        print(f"[attribute] Prim not found: {prim_path}")
        return False

    attr = prim.GetAttribute(attr_name)
    if not attr or not attr.IsValid():
        print(f"[attribute] Attribute not found: {attr_name} on {prim_path}")
        return False

    # Type-aware coercion based on the attribute's declared type
    type_name = attr.GetTypeName()
    if type_name in (Sdf.ValueTypeNames.Float, Sdf.ValueTypeNames.Double, Sdf.ValueTypeNames.Half):
        try:
            typed_value = float(value)
        except (TypeError, ValueError):
            typed_value = value
    elif type_name in (Sdf.ValueTypeNames.Int, Sdf.ValueTypeNames.Int64):
        try:
            typed_value = int(value)
        except (TypeError, ValueError):
            typed_value = value
    elif type_name == Sdf.ValueTypeNames.Bool:
        typed_value = bool(value) if not isinstance(value, bool) else value
    else:
        typed_value = value

    print(f"[attribute] Setting {prim_path}.{attr_name} = {typed_value}")
    attr.Set(typed_value)
    return True
