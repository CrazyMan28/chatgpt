// This is a Fabric mod for Minecraft 1.21
package gemma_minecraftmodcd;

import net.fabricmc.api.ModInitializer;
import net.minecraft.behavior.register;
import net.minecraft.registry.Registry;
import net.minecraft.registry.Registries;
import net.minecraft.item.Item;
import net.minecraft.registry.RegistryBuilder;
import net.minecraft.item.crafting.CraftingAbility;
import net.minecraft.item.crafting.CraftingRecipe;
import net.minecraft.item.crafting.CraftingSlot;
import net.minecraft.item.crafting.CraftingSlot.CraftingType;
import net.minecraft.registry.RegistryBuilder;
import net.minecraft.item.crafting.CraftingAbility;
import net.minecraft.item.crafting.CraftingSlot;

public class GemmaModMod implements ModInitializer {

	public static final String MOD_ID = "gemma_minecraftmodcd";
	public static final String MOD_VERSION = "1.21";

	@Override
	public void onInitialize() {
		// Register custom items here
		registerCustomItems();
	}

	private void registerCustomItems() {
		// Example: Registering a custom item
		Item customWeapon = new Item(new Item.Properties().strength(5.0f).sounds(SoundType.WEAPON_SWORD).texture("item/custom_weapon"));
		Registry.register(Registries.ITEM, new Item.Identifier(MOD_ID + "_weapon"), customWeapon);
	}
}