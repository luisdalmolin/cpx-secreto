import { fireEvent, render } from "@testing-library/react-native";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui";

describe("shared form components", () => {
  test("calls the button handler from its accessible control", async () => {
    const onPress = jest.fn();

    const view = await render(<Button label="Salvar" onPress={onPress} />);
    await fireEvent.press(view.getByRole("button", { name: "Salvar" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("labels the input, reports changes, and exposes validation errors", async () => {
    const onChangeText = jest.fn();

    const view = await render(
      <FormField
        label="Nome"
        error="Informe o nome."
        onChangeText={onChangeText}
      />,
    );
    await fireEvent.changeText(
      view.getByLabelText("Nome"),
      "Amigo Secreto",
    );

    expect(onChangeText).toHaveBeenCalledWith("Amigo Secreto");
    expect(view.getByRole("alert")).toHaveTextContent("Informe o nome.");
  });
});
